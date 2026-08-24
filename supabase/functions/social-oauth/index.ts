import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type Provider = "linkedin" | "facebook";
type Credentials = Record<string, string | number | undefined>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ENCRYPTION_SECRET = Deno.env.get("SOURCE_CONNECTION_SECRET") ?? Deno.env.get("AI_PROVIDER_ENCRYPTION_KEY") ?? "";
const DEFAULT_ORIGINS = [
  "https://ai-lead-hunter-zeta.vercel.app",
  "https://aileadhunter.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function allowedOrigins() {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
}

function cors(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, request: Request) {
  return new Response(JSON.stringify(body), { status, headers: cors(request) });
}

function providerFrom(value: unknown): Provider {
  if (value === "linkedin" || value === "facebook") return value;
  throw new Error("Unsupported OAuth provider");
}

function callbackPath(provider: Provider) {
  return `/oauth/${provider}/callback`;
}

function validateRedirect(provider: Provider, value: unknown) {
  if (typeof value !== "string" || value.length > 500) throw new Error("redirect_uri is required");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("redirect_uri is invalid");
  }
  if (!allowedOrigins().has(parsed.origin) || parsed.pathname !== callbackPath(provider) || parsed.hash) {
    throw new Error("redirect_uri is not allowed");
  }
  return parsed.toString();
}

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array) {
  return encode(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function cryptoKey() {
  if (!ENCRYPTION_SECRET) throw new Error("SOURCE_CONNECTION_SECRET is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ENCRYPTION_SECRET));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}

async function auth(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data, error } = await admin.auth.getUser(header.slice(7));
  return error ? null : data.user;
}

function formBody(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

async function exchangeLinkedIn(code: string, redirectUri: string) {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("LinkedIn OAuth is not configured on the server");
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string") throw new Error(`LinkedIn token exchange failed (${response.status})`);
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || typeof profile.sub !== "string") throw new Error(`LinkedIn profile request failed (${profileResponse.status})`);
  return {
    credentials: {
      access_token: data.access_token,
      refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      expires_at: String(Date.now() + Number(data.expires_in ?? 0) * 1000),
      scope: String(data.scope ?? Deno.env.get("LINKEDIN_OAUTH_SCOPES") ?? "openid profile email"),
      provider_user_id: profile.sub,
      provider_name: String(profile.name ?? "LinkedIn account"),
      provider_email: typeof profile.email === "string" ? profile.email : undefined,
    } satisfies Credentials,
    accountId: profile.sub,
    accountName: String(profile.name ?? profile.email ?? "LinkedIn account"),
    displayName: String(profile.name ?? profile.email ?? "LinkedIn account"),
  };
}

async function exchangeFacebook(code: string, redirectUri: string) {
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appId || !appSecret) throw new Error("Facebook OAuth is not configured on the server");
  const tokenUrl = new URL("https://graph.facebook.com/oauth/access_token");
  tokenUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString();
  const shortResponse = await fetch(tokenUrl);
  const shortData = await shortResponse.json().catch(() => ({}));
  if (!shortResponse.ok || typeof shortData.access_token !== "string") throw new Error(`Facebook token exchange failed (${shortResponse.status})`);

  let accessToken = shortData.access_token as string;
  let expiresIn = Number(shortData.expires_in ?? 0);
  const longUrl = new URL("https://graph.facebook.com/oauth/access_token");
  longUrl.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken,
  }).toString();
  const longResponse = await fetch(longUrl);
  const longData = await longResponse.json().catch(() => ({}));
  if (longResponse.ok && typeof longData.access_token === "string") {
    accessToken = longData.access_token;
    expiresIn = Number(longData.expires_in ?? expiresIn);
  }

  const profileUrl = new URL("https://graph.facebook.com/me");
  profileUrl.search = new URLSearchParams({ fields: "id,name,email", access_token: accessToken }).toString();
  const profileResponse = await fetch(profileUrl);
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || typeof profile.id !== "string") throw new Error(`Facebook profile request failed (${profileResponse.status})`);
  return {
    credentials: {
      access_token: accessToken,
      expires_at: String(Date.now() + expiresIn * 1000),
      scope: Deno.env.get("META_OAUTH_SCOPES") ?? "public_profile,email,pages_show_list",
      provider_user_id: profile.id,
      provider_name: String(profile.name ?? "Facebook account"),
      provider_email: typeof profile.email === "string" ? profile.email : undefined,
    } satisfies Credentials,
    accountId: profile.id,
    accountName: String(profile.name ?? profile.email ?? "Facebook account"),
    displayName: String(profile.name ?? profile.email ?? "Facebook account"),
  };
}

async function saveConnection(provider: Provider, userId: string, result: Awaited<ReturnType<typeof exchangeLinkedIn>>) {
  const sourceId = provider === "linkedin" ? "src-linkedin" : "src-facebook";
  const sourceCode = provider;
  const encrypted = await encrypt(result.credentials);
  const { data: existing, error: lookupError } = await admin
    .from("source_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("source_id", sourceId)
    .eq("external_account_id", result.accountId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const values = {
    user_id: userId,
    source_id: sourceId,
    source_code: sourceCode,
    external_account_id: result.accountId,
    name: result.accountName,
    credentials: {},
    credentials_encrypted: encrypted,
    status: "connected",
    last_tested_at: new Date().toISOString(),
    last_test_result: "OAuth connection verified",
    updated_at: new Date().toISOString(),
  };
  let connectionId: string;
  if (existing?.id) {
    const { error } = await admin.from("source_connections").update(values).eq("id", existing.id).eq("user_id", userId);
    if (error) throw error;
    connectionId = existing.id;
  } else {
    const { data, error } = await admin.from("source_connections").insert(values).select("id").single();
    if (error) throw error;
    connectionId = data.id;
  }
  const { error: secretError } = await admin.from("source_connection_secrets").upsert({
    connection_id: connectionId,
    user_id: userId,
    credentials_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  });
  if (secretError) throw secretError;
  return { connectionId };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, request);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_SECRET) return json({ error: "Server configuration missing" }, 500, request);
  const user = await auth(request);
  if (!user) return json({ error: "Unauthorized" }, 401, request);

  try {
    const payload = await request.json();
    const provider = providerFrom(payload.provider);
    const action = String(payload.action ?? "");

    if (action === "start") {
      const redirectUri = validateRedirect(provider, payload.redirect_uri);
      const rawState = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      const stateHash = await sha256(rawState);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await admin.from("oauth_states").insert({
        state_hash: stateHash,
        provider,
        user_id: user.id,
        redirect_uri: redirectUri,
        expires_at: expiresAt,
      });
      if (error) throw error;

      const authUrl = new URL(provider === "linkedin"
        ? "https://www.linkedin.com/oauth/v2/authorization"
        : "https://www.facebook.com/dialog/oauth");
      const clientId = provider === "linkedin" ? Deno.env.get("LINKEDIN_CLIENT_ID") : Deno.env.get("META_APP_ID");
      const scope = provider === "linkedin"
        ? (Deno.env.get("LINKEDIN_OAUTH_SCOPES") ?? "openid profile email")
        : (Deno.env.get("META_OAUTH_SCOPES") ?? "public_profile,email,pages_show_list");
      if (!clientId) throw new Error(`${provider} OAuth client id is not configured on the server`);
      authUrl.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state: rawState, scope }).toString();
      return json({ success: true, authorization_url: authUrl.toString(), expires_at: expiresAt }, 200, request);
    }

    if (action === "callback") {
      const code = typeof payload.code === "string" ? payload.code : "";
      const rawState = typeof payload.state === "string" ? payload.state : "";
      const redirectUri = validateRedirect(provider, payload.redirect_uri);
      if (!code || !rawState) return json({ error: "OAuth code and state are required" }, 400, request);
      const stateHash = await sha256(rawState);
      const { data: state, error: stateError } = await admin
        .from("oauth_states")
        .select("id,user_id,provider,redirect_uri,expires_at,used_at")
        .eq("state_hash", stateHash)
        .eq("provider", provider)
        .eq("user_id", user.id)
        .maybeSingle();
      if (stateError) throw stateError;
      if (!state || state.used_at || state.redirect_uri !== redirectUri || new Date(state.expires_at).getTime() <= Date.now()) {
        return json({ error: "OAuth state is invalid or expired" }, 400, request);
      }
      const { data: consumed, error: consumeError } = await admin
        .from("oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", state.id)
        .is("used_at", null)
        .select("id")
        .maybeSingle();
      if (consumeError) throw consumeError;
      if (!consumed) return json({ error: "OAuth state has already been used" }, 409, request);

      const result = provider === "linkedin"
        ? await exchangeLinkedIn(code, redirectUri)
        : await exchangeFacebook(code, redirectUri);
      const saved = await saveConnection(provider, user.id, result);
      await admin.from("oauth_states").delete().eq("id", state.id);
      return json({ success: true, provider, connection_id: saved.connectionId, account_name: result.displayName }, 200, request);
    }

    return json({ error: "Unsupported OAuth action" }, 400, request);
  } catch (error) {
    console.error("social-oauth error", error);
    return json({ error: error instanceof Error ? error.message : "OAuth operation failed" }, 500, request);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET = Deno.env.get("SOURCE_CONNECTION_SECRET") ?? Deno.env.get("AI_PROVIDER_ENCRYPTION_KEY") ?? SERVICE_KEY;
const DEFAULT_ORIGINS = ["https://ai-lead-hunter-zeta.vercel.app", "https://aileadhunter.vercel.app"];
const admin = createClient(URL, SERVICE_KEY);

function cors(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = new Set([...DEFAULT_ORIGINS, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean)]);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin && allowed.has(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
function json(body: unknown, status: number, request: Request) { return new Response(JSON.stringify(body), { status, headers: cors(request) }); }
function encode(bytes: Uint8Array) { let value = ""; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value); }
function decode(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function cryptoKey() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SECRET));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), new TextEncoder().encode(JSON.stringify(value)));
  return `${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
async function decrypt(value: string) {
  const [iv, ciphertext] = value.split(".");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, await cryptoKey(), decode(ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, string>;
}
async function auth(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data, error } = await admin.auth.getUser(header.slice(7));
  return error ? null : data.user;
}
async function connection(id: string, userId: string) {
  const { data, error } = await admin.from("source_connections").select("id,user_id,source_id,source_code,name,credentials_encrypted").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
async function linkedInRequest(token: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`LinkedIn Access Token rejected (${response.status})`);
  return response.json();
}
async function run(sourceCode: string, query: Record<string, unknown>, credentials: Record<string, string>) {
  if (sourceCode === "linkedin") {
    const token = credentials.access_token ?? credentials.api_key;
    if (!token) throw new Error("LinkedIn Access Token missing");
    if (query.test === true) {
      await linkedInRequest(token);
      return [];
    }
    throw new Error("LinkedIn search requires an approved LinkedIn Partner/API product; token validation succeeded but search permission is unavailable");
  }
  if (sourceCode === "web_search") {
    if (!credentials.api_key) throw new Error("Search API key missing");
    const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: credentials.api_key, query: query.query, max_results: 10 }) });
    if (!response.ok) throw new Error("Search provider failed");
    const data = await response.json();
    return (data.results ?? []).map((item: Record<string, string>) => ({ job_id: query.job_id, source_code: sourceCode, source_url: item.url ?? "", data: { name: item.title ?? "", content: item.content ?? "", snippet: item.content ?? "", source_url: item.url ?? "", city: query.location ?? "", source_type: "web_result" }, normalized: false }));
  }
  if (sourceCode === "google_maps") {
    if (!credentials.api_key) throw new Error("Google Maps API key missing");
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(String(query.query ?? ""))}&language=ar&key=${encodeURIComponent(credentials.api_key)}`);
    if (!response.ok) throw new Error("Google Maps provider failed");
    const data = await response.json();
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") throw new Error("Google Maps rejected request");
    return (data.results ?? []).map((item: Record<string, unknown>) => ({ job_id: query.job_id, source_code: sourceCode, source_url: `https://www.google.com/maps/place/?q=place_id:${item.place_id ?? ""}`, data: { name: item.name, business_name: item.name, address: item.formatted_address ?? "", rating: item.rating, reviews_count: item.user_ratings_total, maps_url: `https://www.google.com/maps/place/?q=place_id:${item.place_id ?? ""}`, coordinates: (item.geometry as Record<string, unknown> | undefined)?.location, city: query.location ?? "", source_type: "business_listing" }, normalized: false }));
  }
  throw new Error("Connector not enabled server-side");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, request);
  if (!URL || !SERVICE_KEY || !SECRET) return json({ error: "Server configuration missing" }, 500, request);
  const user = await auth(request);
  if (!user) return json({ error: "Unauthorized" }, 401, request);
  try {
    const payload = await request.json();
    const action = String(payload.action ?? "");
    if (action === "create") {
      const id = crypto.randomUUID();
      const encrypted = await encrypt(payload.credentials ?? {});
      const { error } = await admin.from("source_connections").insert({ id, user_id: user.id, source_id: String(payload.source_id ?? ""), source_code: String(payload.source_code ?? ""), name: String(payload.name ?? payload.source_code ?? "Connection"), credentials: null, credentials_encrypted: encrypted, status: "untested" });
      if (error) throw error;
      await admin.from("source_connection_secrets").upsert({ connection_id: id, user_id: user.id, credentials_encrypted: encrypted, updated_at: new Date().toISOString() });
      return json({ success: true, connection_id: id }, 200, request);
    }
    const id = String(payload.connection_id ?? "");
    if (!id) return json({ error: "connection_id required" }, 400, request);
    const current = await connection(id, user.id);
    if (!current) return json({ error: "Connection not found" }, 404, request);
    if (!current.credentials_encrypted) return json({ error: "Connection secret must be migrated" }, 409, request);
    const credentials = await decrypt(current.credentials_encrypted);
    if (action === "test") {
      await run(String(current.source_code ?? ""), { test: true, query: "test" }, credentials);
      await admin.from("source_connections").update({ status: "active", last_test: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
      return json({ success: true, message: "Connection verified" }, 200, request);
    }
    if (action === "search") {
      const records = await run(String(current.source_code ?? ""), { ...(payload.query ?? {}), job_id: payload.job_id }, credentials);
      return json({ records }, 200, request);
    }
    if (action === "update") {
      const encrypted = await encrypt(payload.credentials ?? {});
      const { error } = await admin.from("source_connections").update({ name: String(payload.name ?? current.name), credentials: null, credentials_encrypted: encrypted, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      await admin.from("source_connection_secrets").upsert({ connection_id: id, user_id: user.id, credentials_encrypted: encrypted, updated_at: new Date().toISOString() });
      return json({ success: true }, 200, request);
    }
    return json({ error: "Unsupported action" }, 400, request);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Connector operation failed" }, 500, request);
  }
});

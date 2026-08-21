import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const encoder = new TextEncoder();

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function bytes(value: string) { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
async function encryptSecret(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), encoder.encode(value));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
async function decryptSecret(value: string, secret: string) {
  const [iv, encrypted] = value.split('.');
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await encryptionKey(secret), bytes(encrypted));
  return new TextDecoder().decode(decrypted);
}
async function actor(request: Request, admin: ReturnType<typeof createClient>) {
  const header = request.headers.get('Authorization'); if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, ''); const { data: { user } } = await admin.auth.getUser(token); if (!user) return null;
  const { data: row } = await admin.from('admin_users').select('role,status').eq('id', user.id).maybeSingle();
  return row?.status === 'active' && ['SUPER_ADMIN', 'ADMIN'].includes(row.role) ? user : null;
}
function providerTarget(provider: string, model: string) {
  if (provider === 'openrouter') return { url: 'https://openrouter.ai/api/v1/chat/completions', model: model || 'openrouter/free' };
  if (provider === 'grok') return { url: 'https://api.x.ai/v1/chat/completions', model: model || 'grok-4.6' };
  if (provider === 'openai') return { url: 'https://api.openai.com/v1/chat/completions', model: model || 'gpt-4o-mini' };
  if (provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/messages', model: model || 'claude-3-5-haiku-latest' };
  return { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', model: model || 'gemini-2.5-flash' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server configuration missing' }, 500);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const user = await actor(request, admin); if (!user) return json({ error: 'غير مصرح' }, 403);
  const payload = await request.json().catch(() => ({})); const action = String(payload.action ?? 'list');

  if (action === 'list') {
    const { data, error } = await admin.from('admin_ai_providers').select('id,provider,enabled,api_key_masked,base_url,priority,default_model,fallback_enabled,max_requests,timeout_ms,retry_count,openrouter_auto_mode,model_fallback_chain,capabilities,cooldown_ms,daily_limit,routing_mode,updated_at').order('priority');
    if (error) return json({ error: error.message }, 500);
    return json({ providers: (data ?? []).map((p) => ({ ...p, has_key: Boolean(p.api_key_masked && p.api_key_masked.length > 0) })) });
  }

  const providerId = String(payload.provider_id ?? '');
  if (!providerId) return json({ error: 'provider_id مطلوب' }, 400);
  const { data: provider } = await admin.from('admin_ai_providers').select('id,provider,default_model,api_key_encrypted').eq('id', providerId).maybeSingle();
  if (!provider) return json({ error: 'المزود غير موجود' }, 404);
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (action === 'save') {
    const raw = String(payload.api_key ?? '').trim(); if (raw.length < 8) return json({ error: 'أدخل مفتاحاً صحيحاً' }, 400);
    const masked = `${raw.slice(0, 4)}••••••••${raw.slice(-4)}`;
    const encrypted = await encryptSecret(raw, secret);
    const { error } = await admin.from('admin_ai_providers').update({ api_key_encrypted: encrypted, api_key_masked: masked, updated_at: new Date().toISOString() }).eq('id', providerId);
    if (error) return json({ error: error.message }, 500);
    await admin.from('audit_logs').insert({ user_id: user.id, action: 'ai_provider.key_saved', entity_type: 'ai_provider', entity_id: providerId, details: { provider: provider.provider, has_key: true } });
    return json({ success: true, provider_id: providerId, api_key_masked: masked, has_key: true });
  }

  if (action === 'remove') {
    const { error } = await admin.from('admin_ai_providers').update({ api_key_encrypted: null, api_key_masked: '', updated_at: new Date().toISOString() }).eq('id', providerId);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, provider_id: providerId, has_key: false, api_key_masked: '' });
  }

  if (action === 'test') {
    if (!provider.api_key_encrypted) return json({ success: false, message: 'لم تتم إضافة مفتاح لهذا المزود' });
    const raw = await decryptSecret(provider.api_key_encrypted, secret); const target = providerTarget(provider.provider, provider.default_model);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${raw}` };
    let body: Record<string, unknown> = { model: target.model, messages: [{ role: 'user', content: 'Reply with OK only.' }], max_tokens: 8, temperature: 0 };
    let testUrl = target.url;
    if (provider.provider === 'anthropic') { headers['x-api-key'] = raw; headers['anthropic-version'] = '2023-06-01'; delete headers.Authorization; body = { model: target.model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK only.' }] }; }
    if (provider.provider === 'gemini') { delete headers.Authorization; testUrl = `${target.url}?key=${encodeURIComponent(raw)}`; body = { contents: [{ parts: [{ text: 'Reply with OK only.' }] }], generationConfig: { maxOutputTokens: 8 } }; }
    const response = await fetch(testUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await response.text();
    return json({ success: response.ok, message: response.ok ? 'تم الاتصال بنجاح' : `فشل الاتصال (${response.status})`, provider: provider.provider, detail: response.ok ? undefined : text.slice(0, 300) });
  }
  return json({ error: 'إجراء غير معروف' }, 400);
});

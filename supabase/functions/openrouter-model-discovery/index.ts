import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return { "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : (origin ? "" : "*"), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
const json = (body: unknown, status = 200, request?: Request) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request ?? new Request("http://localhost")), "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  const origin = request.headers.get("Origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403, request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const auth = request.headers.get('Authorization');
  if (!url || !serviceKey || !auth) return json({ error: 'Unauthorized' }, 401);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = auth.replace(/^Bearer\s+/i, ''); const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);
  const { data: actor } = await admin.from('admin_users').select('role,status').eq('id', user.id).maybeSingle();
  if (!actor || actor.status !== 'active' || !['SUPER_ADMIN','ADMIN'].includes(actor.role)) return json({ error: 'غير مصرح' }, 403);
  const apiKey = Deno.env.get('OPENROUTER_API_KEY'); if (!apiKey) return json({ error: 'OPENROUTER_API_KEY غير مضبوط في Supabase' }, 400);
  const response = await fetch('https://openrouter.ai/api/v1/models?output_modalities=text&limit=1000', { headers: { Authorization: `Bearer ${apiKey}` } });
  const payload = await response.json(); if (!response.ok) return json({ error: payload?.error?.message ?? 'تعذر جلب النماذج' }, response.status);
  const models = Array.isArray(payload.data) ? payload.data : [];
  const rows = models.map((m: Record<string, unknown>) => {
    const pricing = (m.pricing ?? {}) as Record<string, string>; const supported = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
    const isFree = Number(pricing.prompt ?? 1) === 0 && Number(pricing.completion ?? 1) === 0;
    return { provider: 'openrouter', model: String(m.id), status: 'ACTIVE', capabilities: [...(supported as string[]), ...((m.architecture as Record<string, unknown>)?.input_modalities as string[] ?? [])], context_length: Number(m.context_length ?? 0), is_free: isFree, updated_at: new Date().toISOString() };
  });
  if (rows.length) await admin.from('ai_model_health').upsert(rows, { onConflict: 'provider,model' });
  return json({ count: rows.length, free_models: rows.filter((m: { is_free: boolean }) => m.is_free).length, models: rows.filter((m: { is_free: boolean }) => m.is_free).slice(0, 200), refreshed_at: new Date().toISOString() });
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createProviderAdapter } from "./adapters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Candidate = { provider: string; model: string; fallbackModels?: string[] };
type ErrorType = 'RATE_LIMIT'|'TIMEOUT'|'NETWORK_ERROR'|'PROVIDER_DOWN'|'MODEL_UNAVAILABLE'|'MODEL_DEPRECATED'|'CONTEXT_TOO_LONG'|'INVALID_REQUEST'|'AUTH_ERROR'|'QUOTA_EXCEEDED'|'CONTENT_POLICY'|'UNKNOWN';

type Payload = {
  task: string; task_id: string; job_id?: string; lead_id?: string; messages: Array<{role: string; content: string}>;
  input_state: Record<string, unknown>; candidates: Candidate[]; settings: Record<string, unknown>;
  structured_schema?: Record<string, unknown>; max_tokens?: number; temperature?: number; idempotency_key?: string;
  simulate?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const encoder = new TextEncoder();
async function secretKey(secret: string) { const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret)); return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']); }
function decode64(value: string) { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
async function decryptProviderKey(value: string, secret: string) { const [iv, encrypted] = value.split('.'); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(iv) }, await secretKey(secret), decode64(encrypted)); return new TextDecoder().decode(plain); }
async function getProviderKey(admin: ReturnType<typeof createClient>, provider: string) {
  const env = Deno.env.get(`${provider.toUpperCase()}_API_KEY`) ?? Deno.env.get(provider === 'gemini' ? 'GOOGLE_API_KEY' : '');
  if (env) return env;
  const { data } = await admin.from('admin_ai_providers').select('api_key_encrypted').eq('provider', provider).maybeSingle();
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return data?.api_key_encrypted && secret ? await decryptProviderKey(data.api_key_encrypted, secret) : '';
}

function classify(error: unknown, status?: number): ErrorType {
  const text = String(error instanceof Error ? error.message : error ?? '').toLowerCase();
  if (status === 401 || status === 403 || text.includes('api key') || text.includes('unauthorized')) return 'AUTH_ERROR';
  if (status === 408 || text.includes('timeout') || text.includes('timed out')) return 'TIMEOUT';
  if (status === 413 || text.includes('context') || text.includes('too long') || text.includes('token limit')) return 'CONTEXT_TOO_LONG';
  if (status === 429 || text.includes('rate limit') || text.includes('too many')) return 'RATE_LIMIT';
  if (status === 402 || text.includes('quota') || text.includes('credit') || text.includes('billing')) return 'QUOTA_EXCEEDED';
  if (status === 404 || text.includes('not found') || text.includes('unavailable') || text.includes('deprecated')) return 'MODEL_UNAVAILABLE';
  if (status && status >= 500 || text.includes('provider down') || text.includes('service unavailable')) return 'PROVIDER_DOWN';
  if (text.includes('network') || text.includes('fetch')) return 'NETWORK_ERROR';
  if (text.includes('moderation') || text.includes('policy') || text.includes('safety')) return 'CONTENT_POLICY';
  if (status === 400 || text.includes('invalid')) return 'INVALID_REQUEST';
  return 'UNKNOWN';
}

function compactState(state: Record<string, unknown>) {
  const serialized = JSON.stringify(state);
  if (serialized.length < 28000) return state;
  const copy = { ...state } as Record<string, unknown>;
  for (const key of ['extracted_records', 'normalized_records', 'candidate_leads', 'decisions']) {
    if (Array.isArray(copy[key])) copy[key] = (copy[key] as unknown[]).slice(-50);
  }
  copy.constraints = { ...(copy.constraints as Record<string, unknown> ?? {}), context_compressed: true, original_size: serialized.length };
  return copy;
}

function parseStructured(content: string, schema?: Record<string, unknown>) {
  if (!schema) return undefined;
  try {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content;
    const start = fenced.indexOf('{'); const end = fenced.lastIndexOf('}');
    return JSON.parse(start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced);
  } catch { return undefined; }
}

async function resolveCandidates(admin: ReturnType<typeof createClient>, payload: Payload): Promise<Candidate[]> {
  const configured = Array.isArray(payload.candidates) ? payload.candidates : [];
  const [{ data: providers }, { data: routers }, { data: models }, { data: breakers }] = await Promise.all([
    admin.from('admin_ai_providers').select('provider,enabled,priority,default_model,fallback_enabled,model_fallback_chain,openrouter_auto_mode'),
    admin.from('admin_ai_model_router').select('task,primary_model,secondary_model,fallback_model').eq('task', payload.task).maybeSingle(),
    admin.from('ai_model_health').select('provider,model,status,is_free,success_rate,cooldown_until').eq('status', 'ACTIVE').limit(500),
    admin.from('ai_circuit_breakers').select('provider,model,state,next_probe_at').limit(100),
  ]);
  const candidates: Candidate[] = [];
  const add = (provider: string, model: string, fallbackModels: string[] = []) => {
    const breaker = (breakers ?? []).find((b: Record<string, unknown>) => b.provider === provider && (!b.model || b.model === model));
    if (payload.settings?.circuit_breaker !== false && breaker?.state === 'OPEN' && breaker.next_probe_at && String(breaker.next_probe_at) > now()) return;
    if (!model || candidates.some((c) => c.provider === provider && c.model === model)) return;
    candidates.push({ provider, model, fallbackModels });
  };
  const free = (models ?? []).filter((m: Record<string, unknown>) => m.is_free && (!m.cooldown_until || String(m.cooldown_until) < now())).sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.success_rate ?? 0) - Number(a.success_rate ?? 0)).map((m: Record<string, unknown>) => String(m.model));
  const router = routers as Record<string, unknown> | null;
  const modelOrder = [router?.primary_model, router?.secondary_model, router?.fallback_model].filter(Boolean).map(String);
  if (payload.settings?.openrouter_enabled !== false && payload.settings?.openrouter_free_enabled !== false && payload.settings?.openrouter_auto_mode !== false) add('openrouter', 'openrouter/free', free.slice(0, 8));
  for (const provider of ((providers ?? []) as Array<Record<string, unknown>>).filter((p) => p.enabled !== false).sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))) {
    const name = String(provider.provider); const preferred = modelOrder.find((m) => m.startsWith(`${name}/`)) ?? String(provider.default_model ?? '');
    if (!preferred) continue;
    const fallbacks = Array.isArray(provider.model_fallback_chain) ? provider.model_fallback_chain.map(String) : modelOrder.filter((m) => m !== preferred);
    add(name, preferred, fallbacks);
  }
  for (const candidate of configured) add(candidate.provider, candidate.model, candidate.fallbackModels ?? []);
  return candidates;
}

async function updateHealth(admin: ReturnType<typeof createClient>, candidate: Candidate, success: boolean, latencyMs: number, errorType?: ErrorType, message?: string, threshold = 5, cooldownMs = 300000) {
  const provider = candidate.provider; const model = candidate.model;
  const [{ data: providerHealth }, { data: modelHealth }, { data: breaker }] = await Promise.all([
    admin.from('ai_provider_health').select('*').eq('provider', provider).maybeSingle(),
    admin.from('ai_model_health').select('*').eq('provider', provider).eq('model', model).maybeSingle(),
    admin.from('ai_circuit_breakers').select('*').eq('provider', provider).is('model', null).maybeSingle(),
  ]);
  const pCount = Number(providerHealth?.requests_count ?? 0) + 1; const pSuccess = Number(providerHealth?.success_rate ?? 0) * Number(providerHealth?.requests_count ?? 0) + (success ? 100 : 0);
  const pFailures = success ? 0 : Number(providerHealth?.consecutive_failures ?? 0) + 1;
  await admin.from('ai_provider_health').upsert({ provider, status: success ? (pFailures ? 'DEGRADED' : 'HEALTHY') : (pFailures >= threshold ? 'OFFLINE' : 'FAILING'), success_rate: Number((pSuccess / pCount).toFixed(2)), failure_rate: Number((100 - pSuccess / pCount).toFixed(2)), average_latency_ms: Math.round(((Number(providerHealth?.average_latency_ms ?? 0) * Number(providerHealth?.requests_count ?? 0)) + latencyMs) / pCount), consecutive_failures: pFailures, recent_errors: success ? (providerHealth?.recent_errors ?? []) : [{ type: errorType ?? 'UNKNOWN', message: message ?? '', at: now() }, ...(providerHealth?.recent_errors ?? [])].slice(0, 10), last_success_at: success ? now() : providerHealth?.last_success_at, last_failure_at: success ? providerHealth?.last_failure_at : now(), requests_count: pCount }, { onConflict: 'provider' });
  const mCount = Number(modelHealth?.requests_count ?? 0) + 1; const mSuccess = Number(modelHealth?.success_rate ?? 0) * Number(modelHealth?.requests_count ?? 0) + (success ? 100 : 0);
  await admin.from('ai_model_health').upsert({ provider, model, status: success ? 'ACTIVE' : (errorType === 'MODEL_DEPRECATED' ? 'DEPRECATED' : 'COOLDOWN'), success_rate: Number((mSuccess / mCount).toFixed(2)), failure_rate: Number((100 - mSuccess / mCount).toFixed(2)), average_latency_ms: Math.round(((Number(modelHealth?.average_latency_ms ?? 0) * Number(modelHealth?.requests_count ?? 0)) + latencyMs) / mCount), requests_count: mCount, fallback_count: Number(modelHealth?.fallback_count ?? 0), last_error: success ? modelHealth?.last_error : message, last_used_at: success ? now() : modelHealth?.last_used_at, last_failure_at: success ? modelHealth?.last_failure_at : now(), cooldown_until: success ? null : new Date(Date.now() + cooldownMs).toISOString(), is_free: model === 'openrouter/free' || Boolean(modelHealth?.is_free) }, { onConflict: 'provider,model' });
  const thresholdValue = Number(breaker?.failure_threshold ?? threshold); const consecutive = success ? 0 : Number(breaker?.consecutive_failures ?? 0) + 1; const state = success ? 'CLOSED' : consecutive >= thresholdValue ? 'OPEN' : 'CLOSED';
  await admin.from('ai_circuit_breakers').upsert({ provider, model: null, state, failure_threshold: thresholdValue, consecutive_failures: consecutive, cooldown_ms: cooldownMs, opened_at: state === 'OPEN' ? now() : null, next_probe_at: state === 'OPEN' ? new Date(Date.now() + cooldownMs).toISOString() : null }, { onConflict: 'provider,model' });
}

async function callAdapter(candidate: Candidate, payload: Payload, apiKey: string, messages: Array<{role: string; content: string}>) {
  const started = Date.now();
  const provider = candidate.provider === 'google' ? 'gemini' : candidate.provider;
  const model = candidate.model;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = '';
  let body: Record<string, unknown>;
  if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
    body = { model, models: candidate.fallbackModels?.length ? candidate.fallbackModels.slice(0, 8) : undefined, messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 1200, provider: { allow_fallbacks: true, require_parameters: false } };
  } else if (provider === 'grok') {
    url = 'https://api.x.ai/v1/chat/completions'; headers.Authorization = `Bearer ${apiKey}`;
    body = { model: model.replace(/^xai\//, ''), messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 1200, response_format: payload.structured_schema ? { type: 'json_object' } : undefined };
  } else if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions'; headers.Authorization = `Bearer ${apiKey}`;
    body = { model, messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 1200, response_format: payload.structured_schema ? { type: 'json_object' } : undefined };
  } else if (provider === 'cerebras') {
    url = 'https://api.cerebras.ai/v1/chat/completions'; headers.Authorization = `Bearer ${apiKey}`;
    body = { model, messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 1200, response_format: payload.structured_schema ? { type: 'json_object' } : undefined };
  } else if (provider === 'mistral') {
    url = 'https://api.mistral.ai/v1/chat/completions'; headers.Authorization = `Bearer ${apiKey}`;
    body = { model, messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 1200, response_format: payload.structured_schema ? { type: 'json_object' } : undefined };
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions'; headers.Authorization = `Bearer ${apiKey}`;
    body = { model, messages, temperature: payload.temperature ?? 0.2, max_tokens: payload.max_tokens ?? 1200, response_format: payload.structured_schema ? { type: 'json_object' } : undefined };
  } else if (provider === 'gemini') {
    const geminiModel = model.replace(/^google\//, '');
    url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
    body = { contents: [{ role: 'user', parts: [{ text: messages.map((m) => `${m.role}: ${m.content}`).join('\n') }] }], generationConfig: { temperature: payload.temperature ?? 0.2, maxOutputTokens: payload.max_tokens ?? 1200, responseMimeType: payload.structured_schema ? 'application/json' : undefined } };
  } else if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages'; headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01';
    body = { model: model.replace(/^anthropic\//, ''), max_tokens: payload.max_tokens ?? 1200, temperature: payload.temperature ?? 0.2, system: messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n'), messages: messages.filter((m) => m.role !== 'system') };
  } else if (provider === 'huggingface') {
    url = `https://api-inference.huggingface.co/models/${model.replace(/^huggingface\//, '')}`; headers.Authorization = `Bearer ${apiKey}`;
    body = { inputs: messages.map((m) => `${m.role}: ${m.content}`).join('\n'), parameters: { max_new_tokens: payload.max_tokens ?? 1200, return_full_text: false } };
  } else throw new Error(`Unsupported provider ${provider}`);

  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), Number(payload.settings?.request_timeout_ms ?? 30000));
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const raw = await response.text(); let data: Record<string, unknown> = {};
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!response.ok) throw Object.assign(new Error(String((data.error as Record<string, unknown>)?.message ?? data.message ?? raw)), { status: response.status });
    let content = '';
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.[0]) content = String(((choices[0].message as Record<string, unknown>)?.content ?? choices[0].text ?? ''));
    else if (provider === 'gemini') content = String((((data.candidates as Array<Record<string, unknown>>)?.[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>)?.[0]?.text ?? '');
    else if (provider === 'anthropic') content = String(((data.content as Array<Record<string, unknown>>)?.[0]?.text ?? ''));
    else if (provider === 'huggingface') content = Array.isArray(data) ? String((data as unknown as Array<Record<string, unknown>>)[0]?.generated_text ?? '') : String(data.generated_text ?? '');
    const usage = (data.usage ?? {}) as Record<string, unknown>;
    return { content, structured: parseStructured(content, payload.structured_schema), latency_ms: Date.now() - started, input_tokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0), output_tokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0), provider, model };
  } finally { clearTimeout(timeout); }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = request.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !authHeader) return json({ error: 'Unauthorized' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, ''); const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);
  let payload: Payload; try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!payload.task_id || !payload.task || !Array.isArray(payload.candidates)) return json({ error: 'task, task_id and candidates are required' }, 400);

  if (payload.idempotency_key) {
    const { data: existing } = await admin.from('ai_task_checkpoints').select('id,provider,model,structured_result,output,token_usage,created_at').eq('idempotency_key', payload.idempotency_key).eq('status', 'completed').maybeSingle();
    if (existing) return json({ success: true, content: existing.output ?? '', structured: existing.structured_result, provider: existing.provider, model: existing.model, latency_ms: 0, usage: existing.token_usage ?? {}, checkpoint_id: existing.id, task_id: payload.task_id, recovered: true, events: ['Idempotency replay avoided duplicate work'] });
  }

  let state = compactState(payload.input_state ?? {}); const candidates = await resolveCandidates(admin, payload);
  const maxRetries = payload.settings?.auto_retry === false ? 0 : Number(payload.settings?.max_retries ?? 2);
  const events: string[] = []; let lastError = ''; let lastErrorType: ErrorType = 'UNKNOWN'; let previousProvider = '';
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const providerKey = await getProviderKey(admin, candidate.provider);
    if (!providerKey && candidate.provider !== 'local') { lastError = `No API key configured for ${candidate.provider}`; lastErrorType = 'AUTH_ERROR'; continue; }
    const attempts = Math.max(1, maxRetries + 1);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const startedAt = now();
      if (payload.simulate === 'openrouter_failure' && candidate.provider === 'openrouter' || payload.simulate === 'gemini_failure' && candidate.provider === 'gemini' || payload.simulate === 'timeout') {
        lastError = `Simulated ${payload.simulate}`; lastErrorType = payload.simulate === 'timeout' ? 'TIMEOUT' : 'PROVIDER_DOWN';
      } else {
        try {
          const adapter = createProviderAdapter(candidate.provider, (input) => callAdapter(input.candidate, input.payload as Payload, input.apiKey, input.messages));
          const result = await (payload.structured_schema ? adapter.generateStructured({ candidate, payload: payload as unknown as Record<string, unknown>, apiKey: providerKey ?? '', messages: payload.messages }) : adapter.generate({ candidate, payload: payload as unknown as Record<string, unknown>, apiKey: providerKey ?? '', messages: payload.messages }));
          await updateHealth(admin, candidate, true, result.latency_ms, undefined, undefined, Number(payload.settings?.circuit_failure_threshold ?? 5), Number(payload.settings?.max_cooldown_ms ?? 300000));
          const checkpoint = { user_id: user.id, job_id: payload.job_id ?? null, task_id: payload.task_id, step: String(state.current_step ?? payload.task), provider: result.provider, model: result.model, status: 'completed', input_context: { messages: payload.messages }, working_state: state, output: result.content, structured_result: result.structured ?? null, token_usage: { input_tokens: result.input_tokens, output_tokens: result.output_tokens }, idempotency_key: payload.idempotency_key ?? null };
          const { data: saved, error: checkpointError } = await admin.from('ai_task_checkpoints').insert(checkpoint).select('id').single();
          if (checkpointError) throw checkpointError;
          await admin.from('ai_runs').insert({ user_id: user.id, job_id: payload.job_id ?? null, lead_id: payload.lead_id ?? null, provider: result.provider, model: result.model, task: payload.task, attempt: attempt + 1, success: true, error_type: null, latency_ms: result.latency_ms, input_tokens: result.input_tokens, output_tokens: result.output_tokens, checkpoint_id: saved.id, fallback_from: previousProvider || null, fallback_to: index > 0 ? result.provider : null, started_at: startedAt, completed_at: now() });
          await admin.from('ai_routing_events').insert({ task_id: payload.task_id, job_id: payload.job_id ?? null, task: payload.task, event_type: 'completed', from_provider: previousProvider || null, to_provider: result.provider, to_model: result.model, message: index > 0 ? 'Task resumed after provider failover' : 'Task completed', metadata: { recovered: index > 0 } });
          if (index > 0) events.push('Checkpoint Saved', `${result.provider} Selected`, 'Context Restored', 'Task Resumed'); else events.push(`${result.provider} Success`);
          return json({ success: true, content: result.content, structured: result.structured, provider: result.provider, model: result.model, latency_ms: result.latency_ms, usage: { input_tokens: result.input_tokens, output_tokens: result.output_tokens }, checkpoint_id: saved.id, task_id: payload.task_id, current_step: state.current_step, recovered: index > 0, events });
        } catch (error) {
          const status = Number((error as { status?: number }).status ?? 0); lastError = String(error instanceof Error ? error.message : error); lastErrorType = classify(error, status);
        }
      }
      await updateHealth(admin, candidate, false, 0, lastErrorType, lastError, Number(payload.settings?.circuit_failure_threshold ?? 5), Number(payload.settings?.max_cooldown_ms ?? 300000));
      await admin.from('ai_runs').insert({ user_id: user.id, job_id: payload.job_id ?? null, lead_id: payload.lead_id ?? null, provider: candidate.provider, model: candidate.model, task: payload.task, attempt: attempt + 1, success: false, error: lastError, error_type: lastErrorType, latency_ms: 0, input_tokens: 0, output_tokens: 0, fallback_to: candidates[index + 1]?.provider ?? null, started_at: startedAt, completed_at: now() });
      await admin.from('ai_routing_events').insert({ task_id: payload.task_id, job_id: payload.job_id ?? null, task: payload.task, event_type: attempt + 1 < attempts ? 'failure' : 'checkpoint_saved', from_provider: candidate.provider, from_model: candidate.model, to_provider: candidates[index + 1]?.provider ?? null, to_model: candidates[index + 1]?.model ?? null, error_type: lastErrorType, message: lastError, metadata: { attempt: attempt + 1 } });
      if (lastErrorType === 'CONTENT_POLICY' || lastErrorType === 'AUTH_ERROR') break;
      if (attempt + 1 < attempts) await sleep(Number(payload.settings?.retry_delay_ms ?? 350) * 2 ** attempt);
    }
    await admin.from('ai_task_checkpoints').insert({ user_id: user.id, job_id: payload.job_id ?? null, task_id: payload.task_id, step: String(state.current_step ?? payload.task), provider: candidate.provider, model: candidate.model, status: 'saved', input_context: { messages: payload.messages }, working_state: state, output: null, structured_result: null, token_usage: {}, idempotency_key: null });
    previousProvider = candidate.provider;
    if (candidates[index + 1]) events.push(`${candidate.provider} Failed`, 'Checkpoint Saved', `Switching to ${candidates[index + 1].provider}`);
  }
  await admin.from('ai_routing_events').insert({ task_id: payload.task_id, job_id: payload.job_id ?? null, task: payload.task, event_type: 'recovery_failed', from_provider: previousProvider || null, error_type: lastErrorType, message: lastError, metadata: {} });
  return json({ success: false, content: '', provider: previousProvider, model: '', latency_ms: 0, usage: { input_tokens: 0, output_tokens: 0 }, error: lastError, error_type: lastErrorType, task_id: payload.task_id, events: [...events, 'Recovery Failed'] }, 502);
});

import type {
  AIErrorType, AIModelHealth, AIProviderCode, AIProviderHealth, AIRequestMessage,
  AIReliabilitySettings, AIRoutingEvent, AIOrchestratorRequest, AIOrchestratorResponse,
  AITaskCheckpoint, AdminAIProvider, AIModelRouter, CanonicalTaskState,
} from '@/types';
import { dbGetAll, dbGet, dbPut, generateId, nowISO } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

const DEFAULT_RELIABILITY: AIReliabilitySettings = {
  routing_mode: 'SMART_AUTO', smart_routing: true, openrouter_enabled: true,
  openrouter_free_enabled: true, openrouter_auto_mode: true, dynamic_free_model_discovery: true,
  global_failover: true, context_preservation: true, checkpointing: true, auto_retry: true,
  circuit_breaker: true, model_health: true, provider_health: true, cost_control: true,
  max_retries: 2, retry_delay_ms: 350, max_cooldown_ms: 300000,
  circuit_failure_threshold: 5, daily_ai_budget_usd: 0, monthly_ai_budget_usd: 0,
  stop_paid_fallback_on_budget: true,
};

const DEFAULT_TASKS: Array<AIModelRouter & { task: string }> = [
  { task: 'research_planning', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'query_generation', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'data_extraction', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'intent_detection', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'huggingface/mistralai/Mistral-7B-Instruct-v0.3' },
  { task: 'lead_scoring', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'entity_matching', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'deduplication', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'summarization', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'lead_qualification', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
  { task: 'agent_reasoning', primary_model: 'openrouter/free', secondary_model: 'google/gemini-2.0-flash-exp:free', fallback_model: 'openai/gpt-4o-mini' },
];

export function classifyAIError(error: unknown, status?: number): AIErrorType {
  const text = String(error instanceof Error ? error.message : error ?? '').toLowerCase();
  if (status === 401 || status === 403 || text.includes('api key') || text.includes('unauthorized')) return 'AUTH_ERROR';
  if (status === 408 || text.includes('timeout') || text.includes('timed out') || text.includes('deadline')) return 'TIMEOUT';
  if (status === 413 || text.includes('context') || text.includes('token limit') || text.includes('too long')) return 'CONTEXT_TOO_LONG';
  if (status === 429 || text.includes('rate limit') || text.includes('too many')) return 'RATE_LIMIT';
  if (status === 402 || text.includes('quota') || text.includes('credit') || text.includes('billing')) return 'QUOTA_EXCEEDED';
  if (status === 404 || text.includes('not found') || text.includes('unavailable') || text.includes('deprecated')) return 'MODEL_UNAVAILABLE';
  if ((status ?? 0) >= 500 || text.includes('provider down') || text.includes('service unavailable')) return 'PROVIDER_DOWN';
  if (text.includes('network') || text.includes('fetch')) return 'NETWORK_ERROR';
  if (text.includes('moderation') || text.includes('policy') || text.includes('safety')) return 'CONTENT_POLICY';
  if (status === 400 || text.includes('invalid')) return 'INVALID_REQUEST';
  return 'UNKNOWN';
}

function settingsFromRows(rows: Array<{ key: string; value: unknown }>): AIReliabilitySettings {
  const result = { ...DEFAULT_RELIABILITY };
  for (const row of rows) {
    const key = row.key.replace(/^ai\./, '') as keyof AIReliabilitySettings;
    if (key in result) (result as Record<string, unknown>)[key] = row.value;
  }
  return result;
}

export async function getAIReliabilitySettings(): Promise<AIReliabilitySettings> {
  try {
    const rows = await dbGetAll<{ key: string; value: unknown }>('admin_config');
    return settingsFromRows(rows.filter((r) => r.key.startsWith('ai.')));
  } catch {
    return DEFAULT_RELIABILITY;
  }
}

export async function getProviderCandidates(task: string, settings = DEFAULT_RELIABILITY): Promise<Array<{ provider: string; model: string; fallbackModels: string[] }>> {
  const [providers, routers, models] = await Promise.all([
    dbGetAll<AdminAIProvider>('admin_ai_providers').catch(() => []),
    dbGetAll<AIModelRouter>('admin_ai_model_router').catch(() => []),
    dbGetAll<AIModelHealth>('ai_model_health').catch(() => []),
  ]);
  const router = routers.find((r) => r.task === task) ?? DEFAULT_TASKS.find((r) => r.task === task);
  const modelOrder = [router?.primary_model, router?.secondary_model, router?.fallback_model].filter(Boolean) as string[];
  const active = providers.filter((p) => p.enabled !== false).sort((a, b) => a.priority - b.priority);
  const pool = models.filter((m) => m.status === 'ACTIVE' && (!m.cooldown_until || m.cooldown_until < nowISO()));
  const freePool = pool.filter((m) => m.is_free).sort((a, b) => b.success_rate - a.success_rate);
  const candidates: Array<{ provider: string; model: string; fallbackModels: string[] }> = [];

  const add = (provider: string, model: string, fallbackModels: string[] = []) => {
    if (!candidates.some((c) => c.provider === provider && c.model === model)) candidates.push({ provider, model, fallbackModels });
  };
  if (settings.openrouter_enabled && settings.openrouter_free_enabled && settings.openrouter_auto_mode) {
    add('openrouter', 'openrouter/free', freePool.filter((m) => m.provider === 'openrouter').map((m) => m.model).slice(0, 8));
  }
  for (const provider of active) {
    if (provider.provider === 'openrouter' && !settings.openrouter_enabled) continue;
    const modelsForProvider = modelOrder.filter((model) => model === provider.default_model || model.startsWith(`${provider.provider}/`));
    const preferred = modelsForProvider[0] ?? provider.default_model;
    if (!preferred) continue;
    const configuredFallbacks = provider.model_fallback_chain ?? modelOrder.filter((m) => m !== preferred);
    add(provider.provider, preferred, configuredFallbacks);
  }
  for (const model of modelOrder) {
    const provider = model.split('/')[0] ?? 'openrouter';
    add(provider === 'google' ? 'gemini' : provider, model, modelOrder.filter((m) => m !== model));
  }
  return candidates;
}

export function compressContext(state: CanonicalTaskState, maxChars = 24000): CanonicalTaskState {
  const serialized = JSON.stringify(state);
  if (serialized.length <= maxChars) return state;
  return {
    ...state,
    extracted_records: state.extracted_records.slice(-50),
    normalized_records: state.normalized_records.slice(-50),
    candidate_leads: state.candidate_leads.slice(-50),
    decisions: state.decisions.slice(-50),
    remaining_work: state.remaining_work.slice(-30),
    constraints: { ...state.constraints, context_compressed: true, original_size: serialized.length },
  };
}

export async function saveCheckpoint(checkpoint: Omit<AITaskCheckpoint, 'id' | 'created_at'>): Promise<AITaskCheckpoint> {
  let userId: string | undefined;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
  }
  const value = { ...checkpoint, id: generateId(), created_at: nowISO(), ...(userId ? { user_id: userId } : {}) } as AITaskCheckpoint & { user_id?: string };
  await dbPut('ai_task_checkpoints', value);
  return value;
}

export async function getLatestCheckpoint(taskId: string): Promise<AITaskCheckpoint | null> {
  const all = await dbGetAll<AITaskCheckpoint>('ai_task_checkpoints');
  return all.filter((c) => c.task_id === taskId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export async function recordRoutingEvent(event: Omit<AIRoutingEvent, 'id' | 'created_at'>): Promise<void> {
  await dbPut('ai_routing_events', { ...event, id: generateId(), created_at: nowISO() });
}

export function userFacingFailoverMessage(errorType?: AIErrorType): string {
  if (errorType === 'CONTENT_POLICY') return 'تعذر تنفيذ هذه الخطوة بسبب قيود المحتوى؛ لم يتم تكرار الطلب تلقائياً.';
  return 'تم تحويل المهمة تلقائياً إلى نموذج بديل لاستكمال العمل.';
}

export async function orchestrateAI(request: AIOrchestratorRequest): Promise<AIOrchestratorResponse> {
  const settings = await getAIReliabilitySettings();
  const taskId = request.task_id || generateId();
  const previous = await getLatestCheckpoint(taskId);
  const state = compressContext(request.input_state ?? previous?.working_state ?? {
    mission: '', objective: '', current_step: 'PLANNING', extracted_records: [], normalized_records: [],
    candidate_leads: [], decisions: [], constraints: {}, remaining_work: [],
  });
  const candidates = await getProviderCandidates(request.task, settings);
  if (candidates.length === 0) throw new Error('لا يوجد مزود AI مفعل أو مضبوط');

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke('ai-orchestrator', {
      body: { ...request, task_id: taskId, input_state: state, candidates, settings, previous_checkpoint_id: previous?.id },
    });
    if (!error && data) return data as AIOrchestratorResponse;
    if (error) throw error;
  }

  // Deterministic local mode keeps the current app usable without provider keys.
  const started = performance.now();
  const simulationEvents = request.simulate ? ['Simulated Failure', 'Checkpoint Saved', 'Context Restored', 'Task Resumed'] : [];
  const localState = request.simulate === 'context_too_long'
    ? compressContext({ ...state, context_compressed: true, compression_reason: 'SIMULATED_CONTEXT_LIMIT', remaining_work: [...(state.remaining_work ?? []), 'RESUME_AFTER_COMPRESSION'] })
    : state;
  const structured = request.structured_schema ? { status: 'success', task: request.task, results: [], confidence: 0, next_step: localState.current_step } : undefined;
  const checkpoint = await saveCheckpoint({
    task_id: taskId, job_id: request.job_id, step: state.current_step, provider: 'local', model: 'rule-based', status: 'completed',
    input_context: { messages: request.messages }, working_state: localState, output: 'تم تنفيذ الخطوة محلياً', structured_result: structured,
    token_usage: { input_tokens: 0, output_tokens: 0 }, idempotency_key: request.idempotency_key,
  });
  await recordRoutingEvent({ task_id: taskId, job_id: request.job_id, task: request.task, event_type: 'completed', from_provider: 'local', from_model: 'rule-based', message: 'Local deterministic completion', metadata: { simulated: Boolean(request.simulate), simulation: request.simulate } });
  return { success: true, content: 'تم تنفيذ الخطوة محلياً مع الحفاظ على الحالة.', structured, provider: 'local', model: 'rule-based', latency_ms: Math.round(performance.now() - started), usage: { input_tokens: 0, output_tokens: 0 }, checkpoint_id: checkpoint.id, task_id: taskId, current_step: localState.current_step, recovered: Boolean(previous), events: request.simulate ? simulationEvents : (previous ? ['Checkpoint Restored', 'Task Resumed'] : ['Task Completed']) };
}

export async function simulateFailover(simulate: AIOrchestratorRequest['simulate']): Promise<AIOrchestratorResponse> {
  return orchestrateAI({
    task: 'agent_reasoning', task_id: `simulation-${Date.now()}`, messages: [{ role: 'user', content: 'Failover simulation' }],
    input_state: { mission: 'اختبار الاستمرارية', objective: 'اختبار التحويل بين المزودين', current_step: 'MATCHING', extracted_records: [], normalized_records: [], candidate_leads: [{ name: 'Lead محفوظ قبل الفشل' }], decisions: [{ decision: 'keep-context' }], constraints: {}, remaining_work: ['SCORING'] },
    structured_schema: { type: 'object', properties: { status: { type: 'string' } } }, simulate,
  });
}

export async function getReliabilitySnapshot() {
  const [providers, models, events, runs] = await Promise.all([
    dbGetAll<AIProviderHealth>('ai_provider_health').catch(() => []),
    dbGetAll<AIModelHealth>('ai_model_health').catch(() => []),
    dbGetAll<AIRoutingEvent>('ai_routing_events').catch(() => []),
    dbGetAll<{ success: boolean; latency_ms: number }>('ai_runs').catch(() => []),
  ]);
  const today = nowISO().slice(0, 10);
  const todayEvents = events.filter((e) => e.created_at.startsWith(today));
  const fallbackEvents = todayEvents.filter((e) => e.event_type === 'provider_switched');
  const recoveries = todayEvents.filter((e) => e.event_type === 'completed' && e.metadata?.recovered === true);
  return { providers, models, events: todayEvents.slice(-100), fallbacks_today: fallbackEvents.length, successful_recoveries: recoveries.length, failed_recoveries: todayEvents.filter((e) => e.event_type === 'recovery_failed').length, average_latency_ms: runs.length ? Math.round(runs.reduce((a, r) => a + r.latency_ms, 0) / runs.length) : 0, free_requests: models.filter((m) => m.is_free).reduce((a, m) => a + m.requests_count, 0), paid_requests: models.filter((m) => !m.is_free).reduce((a, m) => a + m.requests_count, 0) };
}

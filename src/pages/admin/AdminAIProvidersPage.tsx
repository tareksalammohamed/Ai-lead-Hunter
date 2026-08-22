// ============================================================
// AI Providers + AI Model Router
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getAdminAIProviders, updateAdminAIProvider, testAdminAIProvider,
  getAIModelRouter, updateAIModelRouter, removeAdminAIProviderKey,
} from '@/lib/admin-services';
import type { AdminAIProvider, AIModelRouter, AIProviderCode } from '@/types';
import { Card, Button, Input, Toggle, Select, Skeleton, Badge } from '@/components/ui';
import { Cpu, Brain, Save, Zap, CheckCircle2, XCircle, ArrowDown } from 'lucide-react';

export function AdminAIProvidersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [providers, setProviders] = useState<AdminAIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const loaded = await getAdminAIProviders();
    const catalog = [
      { provider: 'openrouter' as AIProviderCode, enabled: true, priority: 1, default_model: 'openrouter/free', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, openrouter_auto_mode: true, model_fallback_chain: [] },
      { provider: 'grok' as AIProviderCode, enabled: false, priority: 2, default_model: 'grok-4.6', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.x.ai/v1', model_fallback_chain: ['grok-4.6-latest'] },
      { provider: 'groq' as AIProviderCode, enabled: false, priority: 3, default_model: 'llama-3.3-70b-versatile', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.groq.com/openai/v1', model_fallback_chain: ['openai/gpt-oss-120b'] },
      { provider: 'cerebras' as AIProviderCode, enabled: false, priority: 4, default_model: 'llama-3.3-70b', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.cerebras.ai/v1', model_fallback_chain: ['qwen-3-32b'] },
      { provider: 'mistral' as AIProviderCode, enabled: false, priority: 5, default_model: 'mistral-small-latest', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.mistral.ai/v1', model_fallback_chain: ['mistral-large-latest'] },
    ];
    const byProvider = new Map<AIProviderCode, AdminAIProvider>(loaded.map((item) => [item.provider, item]));
    const normalized = catalog.map((defaults) => ({ id: `catalog-${defaults.provider}`, ...defaults, api_key_masked: '', has_key: false, ...byProvider.get(defaults.provider) } as AdminAIProvider));
    setProviders([...normalized, ...loaded.filter((item) => !catalog.some((entry) => entry.provider === item.provider))].sort((a, b) => a.priority - b.priority));
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const handleSave = async (id: string) => {
    if (!user) return;
    const updates = editing[id];
    if (!updates) return;
    await updateAdminAIProvider(user.id, id, updates);
    toast('تم حفظ المزود', 'success');
    setEditing((p) => { const c = { ...p }; delete c[id]; return c; });
    loadData();
  };

  const handleRemoveKey = async (id: string) => {
    if (!user || !window.confirm('حذف مفتاح هذا المزود من قاعدة البيانات؟')) return;
    try { await removeAdminAIProviderKey(user.id, id); toast('تم حذف المفتاح', 'success'); await loadData(); }
    catch (error: any) { toast(error.message ?? 'تعذر حذف المفتاح', 'error'); }
  };

  const handleTest = async (id: string) => {
    if (!user) return;
    setTesting(id);
    const result = await testAdminAIProvider(user.id, id);
    toast(result.message, result.success ? 'success' : 'error');
    setTesting(null);
  };

  const update = (id: string, field: string, value: any) => {
    setEditing((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مزودو AI</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة مزودي الذكاء الاصطناعي — المفاتيح محمية</p>
      </div>

      {providers.map((p) => {
        const e = editing[p.id] ?? {};
        return (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: p.enabled ? 'rgb(var(--success-soft))' : 'rgb(var(--bg-secondary))' }}>
                  <Cpu className="w-5 h-5" style={{ color: p.enabled ? 'rgb(var(--success))' : 'rgb(var(--text-muted))' }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{({ openrouter: 'OpenRouter', grok: 'Grok (xAI)', groq: 'Groq', cerebras: 'Cerebras', mistral: 'Mistral AI' } as Record<string, string>)[p.provider] ?? p.provider}</h3>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الأولوية: {p.priority} · {p.default_model}</p>
                  <p className="text-xs mt-1" style={{ color: p.has_key ? 'rgb(var(--success))' : 'rgb(var(--text-muted))' }}>{p.has_key ? 'مفتاح محفوظ في Supabase' : 'لم تتم إضافة مفتاح'}</p>
                  {p.provider === 'openrouter' && <p className="text-xs mt-1" style={{ color: 'rgb(var(--accent))' }}>مفتاح واحد — اختيار وتبديل تلقائي بين النماذج المجانية داخل OpenRouter</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Toggle checked={e.enabled ?? p.enabled} onChange={(v) => update(p.id, 'enabled', v)} />
                <Badge variant={p.enabled ? 'success' : 'default'}>{p.enabled ? 'مفعل' : 'معطل'}</Badge>
              </div>
            </div>

                          <div className="grid grid-cols-2 gap-3">
              <Input label="مفتاح API — يُحفظ في Supabase فقط" type="password" placeholder={p.has_key ? 'مفتاح محفوظ — اكتب قيمة جديدة للاستبدال' : 'الصق مفتاح API هنا'} value={e.api_key_input ?? ''} onChange={(ev) => update(p.id, 'api_key_input', ev.target.value)} />
              <Input label="Base URL" value={e.base_url ?? p.base_url ?? ''} onChange={(ev) => update(p.id, 'base_url', ev.target.value)} placeholder="https://..." />
              <div className="rounded-xl p-3 text-sm col-span-2" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--text-secondary))' }}>
                <strong>{p.provider === 'openrouter' ? 'OpenRouter Free Router' : 'Smart Auto Model Switching'}</strong><br />
                لا تحتاج إلى اختيار نموذج أو إضافة أكثر من مفتاح API واحد. سيختار التطبيق النموذج الافتراضي، ثم ينتقل تلقائياً إلى النماذج البديلة عند الفشل أو انتهاء الحد.
              </div>
              <Input label="الأولوية" type="number" value={e.priority ?? p.priority} onChange={(ev) => update(p.id, 'priority', Number(ev.target.value))} />
              <Input label="الحد الأقصى للطلبات" type="number" value={e.max_requests ?? p.max_requests} onChange={(ev) => update(p.id, 'max_requests', Number(ev.target.value))} />
              <Input label="المهلة (ms)" type="number" value={e.timeout_ms ?? p.timeout_ms} onChange={(ev) => update(p.id, 'timeout_ms', Number(ev.target.value))} />
              <Input label="عدد المحاولات" type="number" value={e.retry_count ?? p.retry_count} onChange={(ev) => update(p.id, 'retry_count', Number(ev.target.value))} />
              <div className="flex items-end">
                <Toggle checked={e.fallback_enabled ?? p.fallback_enabled} onChange={(v) => update(p.id, 'fallback_enabled', v)} label="تفعيل البديل" />
              </div>
              {p.provider === 'openrouter' && <div className="col-span-2 rounded-xl p-3 text-sm" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--text-secondary))' }}>
                OpenRouter يستخدم مفتاح API واحداً فقط. عند تفعيل Auto Mode سيستخدم `openrouter/free` ويختار OpenRouter النموذج المجاني المتاح داخلياً، مع التبديل التلقائي عند فشل النموذج أو مزود الاستضافة. لا تحتاج إلى إدخال أسماء نماذج أو مفاتيح إضافية.
              </div>}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => handleTest(p.id)} disabled={testing === p.id}>
                {testing === p.id ? <Zap className="w-4 h-4 animate-pulse" /> : <Zap className="w-4 h-4" />}
                اختبار الاتصال
              </Button>
              {p.has_key && <Button variant="secondary" onClick={() => handleRemoveKey(p.id)}>حذف المفتاح</Button>}
              {Object.keys(e).length > 0 && (
                <Button onClick={() => handleSave(p.id)}><Save className="w-4 h-4" /> حفظ</Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// AI Model Router
// ============================================================

const TASK_LABELS: Record<string, string> = {
  research_planning: 'تخطيط البحث', data_extraction: 'استخراج البيانات',
  intent_detection: 'كشف النية', lead_scoring: 'تقييم العملاء',
  entity_matching: 'مطابقة الكيانات', summarization: 'التلخيص',
};

export function AdminAIModelsPage() {
  const [router, setRouter] = useState<AIModelRouter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAIModelRouter().then(setRouter).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>التوجيه التلقائي للذكاء الاصطناعي</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>لا حاجة لاختيار نموذج OpenRouter يدوياً</p>
      </div>
      <Card className="p-5">
        <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Smart AI Router فعال</h3>
        <p className="text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
          يستخدم OpenRouter مفتاحاً واحداً مع <code>openrouter/free</code>، ويختار OpenRouter تلقائياً النموذج المجاني المتاح ويبدّل عند الفشل. لإضافة Grok وGroq وCerebras وMistral، انتقل إلى صفحة «مزودو AI» وأدخل مفاتيحهم.
        </p>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {router.map((r) => (
          <Card key={r.task} className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5" style={{ color: 'rgb(var(--accent))' }} />
              <div>
                <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{TASK_LABELS[r.task] ?? r.task}</h3>
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>التوجيه: OpenRouter Free Router تلقائي</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

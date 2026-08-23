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
import { Card, Button, Input, Skeleton, Badge } from '@/components/ui';
import { Cpu, Brain, Save, Zap } from 'lucide-react';

export function AdminAIProvidersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [providers, setProviders] = useState<AdminAIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { api_key_input?: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { success: boolean; message: string }>>({});

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
    const apiKey = editing[id]?.api_key_input?.trim();
    if (!apiKey) return;
    try {
      await updateAdminAIProvider(user.id, id, { api_key_input: apiKey });
      toast('تم حفظ مفتاح API بأمان', 'success');
      setEditing((p) => { const c = { ...p }; delete c[id]; return c; });
      setConnectionStatus((p) => { const c = { ...p }; delete c[id]; return c; });
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حفظ مفتاح API', 'error');
    }
  };

  const handleTest = async (id: string) => {
    if (!user) return;
    setTesting(id);
    const result = await testAdminAIProvider(user.id, id);
    setConnectionStatus((p) => ({ ...p, [id]: result }));
    toast(result.message, result.success ? 'success' : 'error');
    setTesting(null);
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مزودو AI</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>أدخل مفتاح كل مزود واختبر الاتصال. لا توجد إعدادات مكررة لكل مزود.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => {
          const e = editing[p.id] ?? {};
          const status = connectionStatus[p.id];
          const providerNames: Record<string, string> = { openrouter: 'OpenRouter', grok: 'Grok (xAI)', groq: 'Groq', cerebras: 'Cerebras', mistral: 'Mistral AI' };
          const statusLabel = status ? (status.success ? 'متصل' : 'فشل الاتصال') : p.has_key ? 'مفتاح محفوظ — لم يتم الاختبار' : 'غير مُعد';
          const statusColor = status?.success ? 'rgb(var(--success))' : status && !status.success ? 'rgb(var(--danger))' : p.has_key ? 'rgb(var(--warning))' : 'rgb(var(--text-muted))';
          return (
            <Card key={p.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgb(var(--accent-soft))' }}>
                    <Cpu className="w-5 h-5" style={{ color: 'rgb(var(--accent))' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold truncate" style={{ color: 'rgb(var(--text-primary))' }}>{providerNames[p.provider] ?? p.provider}</h3>
                    <p className="text-sm mt-1" style={{ color: statusColor }}>{statusLabel}</p>
                  </div>
                </div>
                <Badge variant={status?.success ? 'success' : status && !status.success ? 'danger' : 'default'}>{statusLabel}</Badge>
              </div>

              <Input
                label="مفتاح API"
                type="password"
                placeholder={p.has_key ? 'مفتاح محفوظ — اكتب قيمة جديدة للاستبدال' : 'الصق مفتاح API هنا'}
                value={e.api_key_input ?? ''}
                onChange={(ev) => setEditing((prev) => ({ ...prev, [p.id]: { api_key_input: ev.target.value } }))}
              />

              <div className="flex gap-2 justify-end">
                {e.api_key_input?.trim() && <Button onClick={() => handleSave(p.id)}><Save className="w-4 h-4" /> حفظ</Button>}
                <Button variant="secondary" onClick={() => handleTest(p.id)} disabled={testing === p.id}>
                  <Zap className="w-4 h-4" /> {testing === p.id ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
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

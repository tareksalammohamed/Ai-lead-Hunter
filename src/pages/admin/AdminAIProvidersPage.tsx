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
import type { AdminAIProvider, AIModelRouter } from '@/types';
import { Card, Button, Input, Toggle, Select, Skeleton, Badge } from '@/components/ui';
import { Cpu, Brain, Save, Zap, CheckCircle2, XCircle, ArrowDown } from 'lucide-react';

export function AdminAIProvidersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [providers, setProviders] = useState<AdminAIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = async () => { setLoading(true); setProviders(await getAdminAIProviders()); setLoading(false); };
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
                  <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{p.provider === 'grok' ? 'Grok (xAI)' : p.provider === 'openrouter' ? 'OpenRouter' : p.provider}</h3>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الأولوية: {p.priority} · {p.default_model}</p>
                  <p className="text-xs mt-1" style={{ color: p.has_key ? 'rgb(var(--success))' : 'rgb(var(--text-muted))' }}>{p.has_key ? 'مفتاح محفوظ في Supabase' : 'لم تتم إضافة مفتاح'}</p>
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
              <Input label="النموذج الافتراضي" value={e.default_model ?? p.default_model} onChange={(ev) => update(p.id, 'default_model', ev.target.value)} />
              <Input label="الأولوية" type="number" value={e.priority ?? p.priority} onChange={(ev) => update(p.id, 'priority', Number(ev.target.value))} />
              <Input label="الحد الأقصى للطلبات" type="number" value={e.max_requests ?? p.max_requests} onChange={(ev) => update(p.id, 'max_requests', Number(ev.target.value))} />
              <Input label="المهلة (ms)" type="number" value={e.timeout_ms ?? p.timeout_ms} onChange={(ev) => update(p.id, 'timeout_ms', Number(ev.target.value))} />
              <Input label="عدد المحاولات" type="number" value={e.retry_count ?? p.retry_count} onChange={(ev) => update(p.id, 'retry_count', Number(ev.target.value))} />
              <div className="flex items-end">
                <Toggle checked={e.fallback_enabled ?? p.fallback_enabled} onChange={(v) => update(p.id, 'fallback_enabled', v)} label="تفعيل البديل" />
              </div>
              {p.provider === 'openrouter' && <>
                <div className="flex items-end"><Toggle checked={e.openrouter_auto_mode ?? p.openrouter_auto_mode ?? true} onChange={(v) => update(p.id, 'openrouter_auto_mode', v)} label="OpenRouter Auto Mode (openrouter/free)" /></div>
                <Input label="Model Fallback Chain (مفصولة بفاصلة)" value={(e.model_fallback_chain ?? p.model_fallback_chain ?? []).join(', ')} onChange={(ev) => update(p.id, 'model_fallback_chain', ev.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="model-a, model-b, model-c" />
              </>}
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [router, setRouter] = useState<AIModelRouter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, any>>({});

  const loadData = async () => { setLoading(true); setRouter(await getAIModelRouter()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const handleSave = async (task: string) => {
    if (!user) return;
    const updates = editing[task];
    if (!updates) return;
    await updateAIModelRouter(user.id, task, updates);
    toast('تم حفظ التوجيه', 'success');
    setEditing((p) => { const c = { ...p }; delete c[task]; return c; });
    loadData();
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>توجيه نماذج AI</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>تحديد النموذج لكل مهمة مع تسلسل بديل</p>
      </div>

      <div className="space-y-3">
        {router.map((r) => {
          const e = editing[r.task] ?? {};
          return (
            <Card key={r.task} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgb(var(--accent-soft))' }}>
                  <Brain className="w-5 h-5" style={{ color: 'rgb(var(--accent))' }} />
                </div>
                <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{TASK_LABELS[r.task]}</h3>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="label">النموذج الأساسي</label>
                  <input className="input" value={e.primary_model ?? r.primary_model} onChange={(ev) => setEditing((p) => ({ ...p, [r.task]: { ...p[r.task], primary_model: ev.target.value } }))} />
                </div>
                <div className="flex items-center gap-2 justify-center"><ArrowDown className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} /><span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>عند الفشل</span></div>
                <div>
                  <label className="label">النموذج البديل</label>
                  <input className="input" value={e.secondary_model ?? r.secondary_model} onChange={(ev) => setEditing((p) => ({ ...p, [r.task]: { ...p[r.task], secondary_model: ev.target.value } }))} />
                </div>
                <div className="flex items-center gap-2 justify-center"><ArrowDown className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} /></div>
                <div>
                  <label className="label">النموذج الاحتياطي</label>
                  <input className="input" value={e.fallback_model ?? r.fallback_model} onChange={(ev) => setEditing((p) => ({ ...p, [r.task]: { ...p[r.task], fallback_model: ev.target.value } }))} />
                </div>
              </div>

              {Object.keys(e).length > 0 && (
                <div className="flex justify-end mt-4">
                  <Button onClick={() => handleSave(r.task)}><Save className="w-4 h-4" /> حفظ</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

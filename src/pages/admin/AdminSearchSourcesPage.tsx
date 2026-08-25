// ============================================================
// Search Providers + Source Connectors
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getSecureSearchProviders, saveSecureSearchProviderKey, testSecureSearchProvider, updateSecureSearchProvider,
  getAdminSourceConnectors, updateSourceConnector, testSourceConnector,
} from '@/lib/admin-services';
import type { AdminSearchProvider, AdminSourceConnector } from '@/types';
import { Card, Button, Input, Toggle, Skeleton, Badge } from '@/components/ui';
import { Search, Plug, Save, Zap, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  healthy: 'success', warning: 'warning', error: 'danger', offline: 'default',
};
const STATUS_LABELS: Record<string, string> = { healthy: 'سليم', warning: 'تحذير', error: 'خطأ', offline: 'غير متصل' };

export function AdminSearchProvidersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [providers, setProviders] = useState<AdminSearchProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<AdminSearchProvider>>>({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setProviders(await getSecureSearchProviders(user.id));
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر تحميل مزودي البحث', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadData(); }, [user?.id]);

  const handleSave = async (id: string) => {
    if (!user) return;
    const changes = editing[id] ?? {};
    const key = keyDrafts[id]?.trim();
    try {
      if (key) await saveSecureSearchProviderKey(user.id, id, key);
      const { api_key_masked: _masked, ...config } = changes;
      if (Object.keys(config).length > 0) await updateSecureSearchProvider(user.id, id, config);
      toast('تم حفظ إعدادات مزود البحث بأمان', 'success');
      setEditing((p) => { const c = { ...p }; delete c[id]; return c; });
      setKeyDrafts((p) => { const c = { ...p }; delete c[id]; return c; });
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حفظ إعدادات مزود البحث', 'error');
    }
  };

  const handleTest = async (id: string) => {
    if (!user) return;
    setTesting(id);
    try {
      const r = await testSecureSearchProvider(user.id, id);
      toast(r.message, r.success ? 'success' : 'error');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر اختبار مزود البحث', 'error');
    } finally {
      setTesting(null);
    }
  };

  const update = (id: string, field: keyof AdminSearchProvider, value: unknown) => setEditing((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  const updateKey = (id: string, value: string) => setKeyDrafts((p) => ({ ...p, [id]: value }));

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مزودو البحث</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة مزودي البحث على الويب</p>
      </div>

      {providers.map((p) => {
        const e = editing[p.id] ?? {};
        return (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: p.enabled ? 'rgb(var(--success-soft))' : 'rgb(var(--bg-secondary))' }}>
                  <Search className="w-5 h-5" style={{ color: p.enabled ? 'rgb(var(--success))' : 'rgb(var(--text-muted))' }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{p.name}</h3>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الأولوية: {p.priority}</p>
                </div>
              </div>
              <Toggle checked={e.enabled ?? p.enabled} onChange={(v) => update(p.id, 'enabled', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="API Key جديد" type="password" placeholder={p.api_key_masked || 'أدخل المفتاح (لا يظهر بعد الحفظ)'} value={keyDrafts[p.id] ?? ''} onChange={(ev) => updateKey(p.id, ev.target.value)} autoComplete="new-password" />
              <Input label="الأولوية" type="number" value={e.priority ?? p.priority} onChange={(ev) => update(p.id, 'priority', Number(ev.target.value))} />
              <Input label="الحد اليومي" type="number" value={e.daily_limit ?? p.daily_limit} onChange={(ev) => update(p.id, 'daily_limit', Number(ev.target.value))} />
              <Input label="طلبات/دقيقة" type="number" value={e.requests_per_minute ?? p.requests_per_minute} onChange={(ev) => update(p.id, 'requests_per_minute', Number(ev.target.value))} />
              <Input label="المهلة (ms)" type="number" value={e.timeout_ms ?? p.timeout_ms} onChange={(ev) => update(p.id, 'timeout_ms', Number(ev.target.value))} />
              <div className="flex items-end"><Toggle checked={e.fallback_enabled ?? p.fallback_enabled} onChange={(v) => update(p.id, 'fallback_enabled', v)} label="تفعيل البديل" /></div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => handleTest(p.id)} disabled={testing === p.id}><Zap className="w-4 h-4" /> اختبار</Button>
              {(Object.keys(e).length > 0 || Boolean(keyDrafts[p.id]?.trim())) && <Button onClick={() => handleSave(p.id)}><Save className="w-4 h-4" /> حفظ</Button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function AdminSourceConnectorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectors, setConnectors] = useState<AdminSourceConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = async () => { setLoading(true); setConnectors(await getAdminSourceConnectors()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const handleToggle = async (code: string, enabled: boolean) => {
    if (!user) return;
    await updateSourceConnector(user.id, code, { enabled });
    toast(enabled ? 'تم تفعيل الموصل' : 'تم تعطيل الموصل', 'success');
    loadData();
  };

  const handleTest = async (code: string) => {
    if (!user) return;
    setTesting(code);
    const r = await testSourceConnector(user.id, code);
    toast(r.message, r.success ? 'success' : 'error');
    setTesting(null);
    loadData();
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>موصلات المصادر</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة موصلات مصادر البحث</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((c) => (
          <Card key={c.code} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.enabled ? 'rgb(var(--accent-soft))' : 'rgb(var(--bg-secondary))' }}>
                  <Plug className="w-5 h-5" style={{ color: c.enabled ? 'rgb(var(--accent))' : 'rgb(var(--text-muted))' }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{c.name}</h3>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{c.auth_type}</p>
                </div>
              </div>
              <Toggle checked={c.enabled} onChange={(v) => handleToggle(c.code, v)} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span style={{ color: 'rgb(var(--text-muted))' }}>الحالة:</span><Badge variant={STATUS_VARIANTS[c.api_status]}>{STATUS_LABELS[c.api_status]}</Badge></div>
              <div className="flex justify-between"><span style={{ color: 'rgb(var(--text-muted))' }}>متاح:</span><span style={{ color: c.available ? 'rgb(var(--success))' : 'rgb(var(--danger))' }}>{c.available ? 'نعم' : 'لا'}</span></div>
              <div className="flex justify-between"><span style={{ color: 'rgb(var(--text-muted))' }}>الاستخدام:</span><span style={{ color: 'rgb(var(--text-primary))' }}>{c.usage_count}</span></div>
              <div className="flex justify-between"><span style={{ color: 'rgb(var(--text-muted))' }}>الحد اليومي:</span><span style={{ color: 'rgb(var(--text-primary))' }}>{c.limits.max_per_day}</span></div>
              <div className="flex justify-between"><span style={{ color: 'rgb(var(--text-muted))' }}>آخر اختبار:</span><span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{c.last_test ? new Date(c.last_test).toLocaleDateString('ar-EG') : '—'}</span></div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => handleTest(c.code)} disabled={testing === c.code}>
                {testing === c.code ? <Zap className="w-4 h-4 animate-pulse" /> : <Zap className="w-4 h-4" />}
                اختبار
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

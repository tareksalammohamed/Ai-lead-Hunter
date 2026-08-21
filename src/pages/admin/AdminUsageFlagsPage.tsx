// ============================================================
// Usage & Limits + Feature Flags
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getAdminUsers, updateUserLimits, getFeatureFlags, updateFeatureFlag } from '@/lib/admin-services';
import type { AdminUser, FeatureFlag } from '@/types';
import { Card, Button, Input, Toggle, Skeleton, Badge, Select } from '@/components/ui';
import { Gauge, Flag, Save, Search } from 'lucide-react';

// ============================================================
// Usage & Limits
// ============================================================
export function AdminUsageLimitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, any>>({});

  const loadData = async () => { setLoading(true); setUsers(await getAdminUsers()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || u.full_name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async (id: string) => {
    if (!user) return;
    await updateUserLimits(user.id, id, editing[id]);
    toast('تم حفظ الحدود', 'success');
    setEditing((p) => { const c = { ...p }; delete c[id]; return c; });
    loadData();
  };

  const update = (id: string, field: string, value: number) => setEditing((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const limitFields: { key: keyof AdminUser['limits']; label: string }[] = [
    { key: 'max_daily_searches', label: 'حد البحث اليومي' },
    { key: 'max_monthly_searches', label: 'حد البحث الشهري' },
    { key: 'max_daily_leads', label: 'حد العملاء اليومي' },
    { key: 'max_monthly_leads', label: 'حد العملاء الشهري' },
    { key: 'max_ai_requests', label: 'حد طلبات AI' },
    { key: 'max_exports', label: 'حد التصدير' },
    { key: 'max_active_jobs', label: 'حد الوظائف النشطة' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الاستخدام والحدود</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة حدود الاستخدام لكل مستخدم</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
        <input className="input pr-10" placeholder="بحث عن مستخدم..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.map((u) => {
        const e = editing[u.id] ?? {};
        const hasEdits = Object.keys(e).length > 0;
        return (
          <Card key={u.id} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>{u.full_name[0]}</div>
              <div className="flex-1"><p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{u.full_name}</p><p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{u.email}</p></div>
              <Badge>{u.role}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {limitFields.map((f) => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <Input type="number" value={e[f.key] ?? u.limits[f.key]} onChange={(ev) => update(u.id, f.key, Number(ev.target.value))} />
                </div>
              ))}
            </div>
            {hasEdits && <div className="flex justify-end mt-3"><Button onClick={() => handleSave(u.id)}><Save className="w-4 h-4" /> حفظ</Button></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Feature Flags
// ============================================================
export function AdminFeatureFlagsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => { setLoading(true); setFlags(await getFeatureFlags()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    if (!user) return;
    await updateFeatureFlag(user.id, id, { enabled });
    toast(enabled ? 'تم تفعيل الميزة' : 'تم تعطيل الميزة', 'success');
    loadData();
  };

  const handleScopeChange = async (id: string, scope: FeatureFlag['scope']) => {
    if (!user) return;
    await updateFeatureFlag(user.id, id, { scope });
    loadData();
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>ميزات النظام</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>تفعيل وتعطيل الميزات بدون تعديل الكود</p>
      </div>

      <div className="space-y-3">
        {flags.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: f.enabled ? 'rgb(var(--success-soft))' : 'rgb(var(--bg-secondary))' }}>
                  <Flag className="w-5 h-5" style={{ color: f.enabled ? 'rgb(var(--success))' : 'rgb(var(--text-muted))' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{f.name}</h3>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{f.description}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>{f.key}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select value={f.scope} onChange={(e) => handleScopeChange(f.id, e.target.value as FeatureFlag['scope'])} className="text-xs py-1 w-32">
                  <option value="global">عام</option>
                  <option value="role">حسب الدور</option>
                  <option value="user">حسب المستخدم</option>
                </Select>
                <Toggle checked={f.enabled} onChange={(v) => handleToggle(f.id, v)} />
                <Badge variant={f.enabled ? 'success' : 'default'}>{f.enabled ? 'مفعلة' : 'معطلة'}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Security Center + Audit Logs + System Health + Notifications + Maintenance
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getSecurityEvents, forceLogoutUser, getAdminAuditLogs,
  getSystemHealth, runHealthCheck, getAdminUsers,
  getAdminNotifications, updateAdminNotification,
  getMaintenanceOps, runMaintenanceOp,
} from '@/lib/admin-services';
import type { SecurityEvent, SystemHealthCheck, AdminNotificationConfig, MaintenanceOperation, AdminUser } from '@/types';
import { Card, Button, Toggle, Input, Skeleton, Badge, Modal } from '@/components/ui';
import {
  Shield, ScrollText, HeartPulse, Bell, Wrench, CheckCircle2, AlertTriangle,
  XCircle, RefreshCw, Play, Trash2, AlertOctagon, Activity,
} from 'lucide-react';

// ============================================================
// Security Center
// ============================================================
export function AdminSecurityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [e, u] = await Promise.all([getSecurityEvents(), getAdminUsers()]);
    setEvents(e); setUsers(u); setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const handleForceLogout = async (id: string) => {
    if (!user) return;
    await forceLogoutUser(user.id, id);
    toast('تم تسجيل خروج المستخدم', 'success');
    setConfirmLogout(null); loadData();
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const sevVariants: Record<string, 'success' | 'warning' | 'danger' | 'info'> = { low: 'info', medium: 'warning', high: 'danger', critical: 'danger' };
  const sevLabels: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالي', critical: 'حرج' };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مركز الأمان</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>مراقبة الأحداث الأمنية وإدارة الجلسات</p>
      </div>

      {/* Quick actions */}
      <Card className="p-5">
        <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>إجراءات أمنية</h3>
        <div className="space-y-2">
          {users.filter((u) => u.status === 'active' && u.role !== 'SUPER_ADMIN').map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{u.full_name} ({u.email})</span>
              </div>
              <Button variant="danger" onClick={() => setConfirmLogout(u.id)}><AlertOctagon className="w-4 h-4" /> تسجيل خروج إجباري</Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Security events */}
      <Card className="p-5">
        <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>الأحداث الأمنية</h3>
        {events.length > 0 ? (
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgb(var(--danger-soft))' }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: 'rgb(var(--danger))' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{e.description}</p>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{e.type} · {new Date(e.created_at).toLocaleString('ar-EG')}</p>
                </div>
                <Badge variant={sevVariants[e.severity]}>{sevLabels[e.severity]}</Badge>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد أحداث أمنية</p>}
      </Card>

      <Modal open={!!confirmLogout} onClose={() => setConfirmLogout(null)} title="تأكيد تسجيل الخروج الإجباري">
        <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>هل تريد تسجيل خروج هذا المستخدم قسراً؟</p>
        <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setConfirmLogout(null)}>إلغاء</Button><Button variant="danger" onClick={() => confirmLogout && handleForceLogout(confirmLogout)}>تأكيد</Button></div>
      </Modal>
    </div>
  );
}

// ============================================================
// Audit Logs
// ============================================================
export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { (async () => { setLogs(await getAdminAuditLogs(200)); setLoading(false); })(); }, []);

  const filtered = logs.filter((l) => l.action.toLowerCase().includes(search.toLowerCase()) || (l.entity_type ?? '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>سجل التدقيق</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>سجل كامل لجميع العمليات في النظام — لا يمكن حذف السجلات</p>
      </div>

      <input className="input" placeholder="بحث في السجلات..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr style={{ background: 'rgb(var(--bg-secondary))' }}>
              {['الإجراء', 'النوع', 'المعرف', 'التفاصيل', 'الوقت'].map((h) => <th key={h} className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.slice(0, 100).map((l) => (
                <tr key={l.id} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                  <td className="p-3 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{l.action}</td>
                  <td className="p-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{l.entity_type}</td>
                  <td className="p-3 text-xs font-mono" style={{ color: 'rgb(var(--text-muted))' }}>{l.entity_id?.slice(0, 8) ?? '—'}</td>
                  <td className="p-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{JSON.stringify(l.details).slice(0, 60)}</td>
                  <td className="p-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{new Date(l.created_at).toLocaleString('ar-EG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-center" style={{ color: 'rgb(var(--text-muted))' }}>عرض {Math.min(filtered.length, 100)} من {filtered.length} سجل</p>
    </div>
  );
}

// ============================================================
// System Health
// ============================================================
export function AdminHealthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<SystemHealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = async () => { setLoading(true); setChecks(await getSystemHealth()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const handleRunCheck = async () => {
    if (!user) return;
    setRunning(true);
    const results = await runHealthCheck(user.id);
    setChecks(results); setRunning(false);
    toast('تم فحص النظام', 'success');
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const statusIcons: Record<string, any> = { healthy: CheckCircle2, warning: AlertTriangle, error: XCircle, offline: XCircle };
  const statusColors: Record<string, string> = { healthy: 'rgb(var(--success))', warning: 'rgb(var(--warning))', error: 'rgb(var(--danger))', offline: 'rgb(var(--text-muted))' };
  const statusLabels: Record<string, string> = { healthy: 'سليم', warning: 'تحذير', error: 'خطأ', offline: 'غير متصل' };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>صحة النظام</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>مراقبة جميع مكونات النظام</p>
        </div>
        <Button onClick={handleRunCheck} disabled={running}><RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} /> فحص شامل</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checks.map((c) => {
          const Icon = statusIcons[c.status] ?? XCircle;
          const color = statusColors[c.status] ?? 'rgb(var(--text-muted))';
          return (
            <Card key={c.component} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{c.component}</h3>
                    <Badge variant={c.status === 'healthy' ? 'success' : c.status === 'warning' ? 'warning' : 'danger'}>{statusLabels[c.status]}</Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                <div><span style={{ color: 'rgb(var(--text-muted))' }}>زمن الاستجابة: </span><span style={{ color: 'rgb(var(--text-primary))' }}>{c.latency_ms}ms</span></div>
                <div><span style={{ color: 'rgb(var(--text-muted))' }}>معدل الخطأ: </span><span style={{ color: 'rgb(var(--text-primary))' }}>{c.error_rate}%</span></div>
                <div><span style={{ color: 'rgb(var(--text-muted))' }}>آخر فحص: </span><span style={{ color: 'rgb(var(--text-primary))' }}>{new Date(c.last_check).toLocaleTimeString('ar-EG')}</span></div>
              </div>
              {c.message && <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'rgb(var(--warning-soft))', color: 'rgb(var(--warning))' }}>{c.message}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Notifications
// ============================================================
export function AdminNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifs, setNotifs] = useState<AdminNotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, any>>({});

  const loadData = async () => { setLoading(true); setNotifs(await getAdminNotifications()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const handleToggle = async (key: string, enabled: boolean) => {
    if (!user) return;
    await updateAdminNotification(user.id, key, { enabled });
    loadData();
  };

  const handleSave = async (key: string) => {
    if (!user) return;
    await updateAdminNotification(user.id, key, editing[key]);
    toast('تم حفظ الإشعار', 'success');
    setEditing((p) => { const c = { ...p }; delete c[key]; return c; });
    loadData();
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const sevLabels: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالي', critical: 'حرج' };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الإشعارات</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة إشعارات النظام</p>
      </div>

      {notifs.map((n) => {
        const e = editing[n.key] ?? {};
        return (
          <Card key={n.key} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: n.enabled ? 'rgb(var(--accent-soft))' : 'rgb(var(--bg-secondary))' }}>
                  <Bell className="w-4 h-4" style={{ color: n.enabled ? 'rgb(var(--accent))' : 'rgb(var(--text-muted))' }} />
                </div>
                <div><h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{n.name}</h3><Badge variant={n.severity === 'critical' ? 'danger' : n.severity === 'high' ? 'warning' : 'info'}>{sevLabels[n.severity]}</Badge></div>
              </div>
              <Toggle checked={n.enabled} onChange={(v) => handleToggle(n.key, v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">المستوى</label>
                <select className="input" value={e.severity ?? n.severity} onChange={(ev) => setEditing((p) => ({ ...p, [n.key]: { ...p[n.key], severity: ev.target.value } }))}>
                  <option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالي</option><option value="critical">حرج</option>
                </select>
              </div>
              <div>
                <label className="label">المستلمون (مفصولين بفاصلة)</label>
                <input className="input" value={(e.recipients ?? n.recipients).join(', ')} onChange={(ev) => setEditing((p) => ({ ...p, [n.key]: { ...p[n.key], recipients: ev.target.value.split(',').map((s) => s.trim()).filter(Boolean) } }))} />
              </div>
            </div>
            {Object.keys(e).length > 0 && <div className="flex justify-end mt-3"><Button onClick={() => handleSave(n.key)}>حفظ</Button></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Maintenance
// ============================================================
const MAINTENANCE_OPS = [
  { op: 'clear_failed_jobs', label: 'مسح الوظائف الفاشلة', desc: 'حذف جميع الوظائف الفاشلة من قاعدة البيانات', danger: true },
  { op: 'retry_failed_jobs', label: 'إعادة محاولة الوظائف الفاشلة', desc: 'إعادة تشغيل الوظائف التي فشلت' },
  { op: 'rebuild_search_index', label: 'إعادة بناء فهرس البحث', desc: 'تحسين أداء البحث' },
  { op: 'recalculate_lead_scores', label: 'إعادة حساب نتائج العملاء', desc: 'تطبيق إعدادات التقييم الجديدة' },
  { op: 'run_duplicate_detection', label: 'تشغيل كشف التكرار', desc: 'فحص جميع العملاء للتكرار' },
  { op: 'reprocess_failed_ai', label: 'إعادة معالجة طلبات AI الفاشلة', desc: 'إعادة إرسال الطلبات الفاشلة' },
];

export function AdminMaintenancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ops, setOps] = useState<MaintenanceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOp, setConfirmOp] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const loadData = async () => { setLoading(true); setOps(await getMaintenanceOps()); setLoading(false); };
  useEffect(() => { loadData(); }, []);

  const handleRun = async () => {
    if (!user || !confirmOp) return;
    setRunning(true);
    await runMaintenanceOp(user.id, confirmOp);
    setRunning(false); setConfirmOp(null);
    toast('تمت العملية بنجاح', 'success');
    loadData();
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الصيانة</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>عمليات الصيانة والإصلاح</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MAINTENANCE_OPS.map((m) => (
          <Card key={m.op} className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: m.danger ? 'rgb(var(--danger-soft))' : 'rgb(var(--accent-soft))' }}>
                <Wrench className="w-5 h-5" style={{ color: m.danger ? 'rgb(var(--danger))' : 'rgb(var(--accent))' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{m.label}</h3>
                <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{m.desc}</p>
              </div>
            </div>
            <Button variant={m.danger ? 'danger' : 'primary'} className="w-full" onClick={() => setConfirmOp(m.op)}><Play className="w-4 h-4" /> تشغيل</Button>
          </Card>
        ))}
      </div>

      {/* Recent operations */}
      {ops.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>العمليات الأخيرة</h3>
          <div className="space-y-2">
            {ops.slice(0, 10).map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: o.status === 'completed' ? 'rgb(var(--success-soft))' : o.status === 'failed' ? 'rgb(var(--danger-soft))' : 'rgb(var(--warning-soft))' }}>
                  {o.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'rgb(var(--success))' }} /> : o.status === 'failed' ? <XCircle className="w-3.5 h-3.5" style={{ color: 'rgb(var(--danger))' }} /> : <Activity className="w-3.5 h-3.5" style={{ color: 'rgb(var(--warning))' }} />}
                </div>
                <div className="flex-1"><p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{o.operation}</p><p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{o.result ?? o.status} · {new Date(o.started_at).toLocaleString('ar-EG')}</p></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!confirmOp} onClose={() => setConfirmOp(null)} title="تأكيد العملية">
        <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>هل أنت متأكد من تشغيل هذه العملية؟ قد تستغرق بعض الوقت.</p>
        <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setConfirmOp(null)}>إلغاء</Button><Button variant="danger" onClick={handleRun} disabled={running}>{running ? 'جاري...' : 'تأكيد وتشغيل'}</Button></div>
      </Modal>
    </div>
  );
}

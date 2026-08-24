// ============================================================
// System Settings — with versioning and reset to default
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getSystemConfigs, updateSystemConfig, resetConfigToDefault, getConfigHistory } from '@/lib/admin-services';
import type { SystemConfig, ConfigChange, ConfigSection } from '@/types';
import type { AdminPageKey } from '@/components/AdminLayout';
import { Card, Button, Input, Toggle, Modal, Skeleton, Badge } from '@/components/ui';
import { Settings, Save, RotateCcw, History, Search, Cpu, Plug, Activity, Shield, Bell } from 'lucide-react';

const SECTION_LABELS: Record<ConfigSection, string> = {
  general: 'عام', application: 'التطبيق', research: 'البحث', ai: 'AI',
  search: 'البحث', leads: 'العملاء', security: 'الأمان', notifications: 'الإشعارات', limits: 'الحدود',
};

export function AdminSettingsPage({ onNavigate }: { onNavigate?: (page: AdminPageKey) => void } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<ConfigSection>('general');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [history, setHistory] = useState<ConfigChange[]>([]);

  const loadData = async () => {
    setLoading(true);
    setConfigs(await getSystemConfigs());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const sections = [...new Set(configs.map((c) => c.section))] as ConfigSection[];
  const filtered = configs.filter((c) => {
    if (c.section !== section) return false;
    if (search) return c.name.includes(search) || c.key.includes(search);
    return true;
  });

  const handleSave = async (key: string) => {
    if (!user) return;
    const value = editing[key];
    if (value === undefined) return;
    await updateSystemConfig(user.id, key, value);
    toast('تم حفظ الإعداد', 'success');
    setEditing((prev) => { const c = { ...prev }; delete c[key]; return c; });
    loadData();
  };

  const handleReset = async (key: string) => {
    if (!user) return;
    await resetConfigToDefault(user.id, key);
    toast('تم إعادة الإعداد للقيمة الافتراضية', 'success');
    loadData();
  };

  const handleViewHistory = async (key: string) => {
    setHistoryKey(key);
    setHistory(await getConfigHistory(key));
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مركز الإعدادات</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>كل إعدادات النظام مرتبة حسب نوعها من مكان واحد</p>
      </div>

      <Card className="p-5"><div className="flex items-center gap-2 mb-4"><Settings className="w-5 h-5" style={{ color: 'rgb(var(--accent))' }} /><div><h2 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مركز الإعدادات الموحد</h2><p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>كل إعدادات التطبيق مرتبة حسب نوعها من مكان واحد.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{([{ page: 'ai_reliability', title: 'المفاتيح والتكاملات', description: 'مفاتيح AI ومزودو البحث وLinkedIn وGoogle Maps وFacebook من مكان واحد.', icon: Cpu }, { page: 'research_engine', title: 'محرك البحث', description: 'الحدود والمهل والتوازي وسلوك البحث.', icon: Activity }, { page: 'security', title: 'الأمان والصلاحيات', description: 'الأمان والأدوار وصلاحيات الإدارة.', icon: Shield }, { page: 'notifications', title: 'الإشعارات', description: 'إعدادات التنبيهات وإشعارات النظام.', icon: Bell }] as const).map(({ page, title, description, icon: Icon }) => <button key={title} onClick={() => onNavigate?.(page)} className="text-right rounded-xl p-4 transition-all" style={{ background: 'rgb(var(--bg-secondary))', border: '1px solid rgb(var(--border))' }}><div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} /><span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</span></div><p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{description}</p></button>)}</div></Card>

      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {sections.map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all"
            style={section === s ? { background: 'rgb(var(--accent))', color: 'white' } : { color: 'rgb(var(--text-secondary))', background: 'rgb(var(--bg-secondary))' }}>
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
        <input className="input pr-10" placeholder="بحث في الإعدادات..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Config cards */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const editValue = editing[c.key] !== undefined ? editing[c.key] : c.value;
          const isModified = String(c.value) !== String(c.default_value);
          return (
            <Card key={c.key} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{c.name}</h3>
                    {isModified && <Badge variant="warning">معدّل</Badge>}
                    <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-muted))' }}>{c.key}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{c.description}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleViewHistory(c.key)} className="btn btn-ghost p-1.5" title="السجل"><History className="w-4 h-4" /></button>
                  <button onClick={() => handleReset(c.key)} className="btn btn-ghost p-1.5" title="إعادة للقيمة الافتراضية"><RotateCcw className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  {c.type === 'boolean' ? (
                    <Toggle checked={editValue === true} onChange={(v) => setEditing((prev) => ({ ...prev, [c.key]: v }))} />
                  ) : c.type === 'number' ? (
                    <input type="number" className="input" value={editValue as number} onChange={(e) => setEditing((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))} />
                  ) : (
                    <input className="input" value={String(editValue)} onChange={(e) => setEditing((prev) => ({ ...prev, [c.key]: e.target.value }))} />
                  )}
                </div>
                <div className="text-xs text-left" style={{ color: 'rgb(var(--text-muted))' }}>
                  <p>الافتراضي: {String(c.default_value)}</p>
                  <p>آخر تحديث: {new Date(c.updated_at).toLocaleDateString('ar-EG')}</p>
                </div>
                {editing[c.key] !== undefined && (
                  <Button onClick={() => handleSave(c.key)}><Save className="w-4 h-4" /> حفظ</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* History Modal */}
      <Modal open={!!historyKey} onClose={() => setHistoryKey(null)} title={`سجل التغييرات: ${historyKey}`} maxWidth="max-w-lg">
        {history.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="p-3 rounded-lg" style={{ background: 'rgb(var(--bg-secondary))' }}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="info">{h.changed_by}</Badge>
                  <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{new Date(h.changed_at).toLocaleString('ar-EG')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="line-through" style={{ color: 'rgb(var(--danger))' }}>{h.old_value}</span>
                  <span>←</span>
                  <span className="font-semibold" style={{ color: 'rgb(var(--success))' }}>{h.new_value}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--text-muted))' }}>لا يوجد سجل تغييرات</p>
        )}
      </Modal>
    </div>
  );
}

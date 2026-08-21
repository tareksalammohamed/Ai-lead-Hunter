// ============================================================
// Roles & Permissions — Permission Matrix
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getAdminRoles, createAdminRole, updateAdminRole, deleteAdminRole } from '@/lib/admin-services';
import { ALL_PERMISSIONS } from '@/lib/rbac';
import type { RoleDefinition, Permission } from '@/types';
import { Card, Button, Input, Textarea, Modal, Skeleton, Badge, Toggle } from '@/components/ui';
import { KeyRound, Plus, Trash2, Shield, Check, X } from 'lucide-react';

const PERM_LABELS: Record<Permission, string> = {
  view_dashboard: 'عرض لوحة التحكم',
  create_campaign: 'إنشاء حملة',
  run_agent: 'تشغيل البحث',
  view_leads: 'عرض العملاء',
  edit_leads: 'تعديل العملاء',
  delete_leads: 'حذف العملاء',
  export_leads: 'تصدير العملاء',
  manage_sources: 'إدارة المصادر',
  manage_ai: 'إدارة AI',
  manage_users: 'إدارة المستخدمين',
  manage_settings: 'إدارة الإعدادات',
  view_analytics: 'عرض التحليلات',
  view_audit_logs: 'عرض سجل التدقيق',
  manage_billing: 'إدارة الفوترة',
  access_super_admin: 'وصول Super Admin',
};

export function AdminRolesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPerms, setNewPerms] = useState<Permission[]>([]);

  const loadData = async () => {
    setLoading(true);
    setRoles(await getAdminRoles());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const togglePerm = (role: RoleDefinition, perm: Permission) => {
    if (role.is_system && role.name === 'SUPER_ADMIN') return;
    const has = role.permissions.includes(perm);
    const updated = has ? role.permissions.filter((p) => p !== perm) : [...role.permissions, perm];
    handleUpdate(role.id, { permissions: updated });
  };

  const handleUpdate = async (id: string, updates: Partial<RoleDefinition>) => {
    if (!user) return;
    await updateAdminRole(user.id, id, updates);
    loadData();
  };

  const handleCreate = async () => {
    if (!user || !newName) return;
    await createAdminRole(user.id, newName, newDesc, newPerms);
    toast('تم إنشاء الدور', 'success');
    setShowCreate(false); setNewName(''); setNewDesc(''); setNewPerms([]);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteAdminRole(user.id, id);
      toast('تم حذف الدور', 'success');
      loadData();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الأدوار والصلاحيات</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>مصفوفة الصلاحيات — RBAC</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> دور مخصص</Button>
      </div>

      {/* Permission Matrix */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgb(var(--bg-secondary))' }}>
                <th className="text-right p-3 text-xs font-semibold sticky right-0" style={{ color: 'rgb(var(--text-muted))', background: 'rgb(var(--bg-secondary))' }}>الصلاحية</th>
                {roles.map((r) => (
                  <th key={r.id} className="p-3 text-xs font-semibold text-center min-w-32" style={{ color: 'rgb(var(--text-muted))' }}>
                    <div className="flex flex-col items-center gap-1">
                      {r.name === 'SUPER_ADMIN' ? <Shield className="w-4 h-4" style={{ color: 'rgb(var(--danger))' }} /> : null}
                      <span>{r.name}</span>
                      {!r.is_system && (
                        <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:opacity-70"><Trash2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((perm) => (
                <tr key={perm} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                  <td className="p-3 text-sm sticky right-0" style={{ color: 'rgb(var(--text-primary))', background: 'rgb(var(--bg-card))' }}>{PERM_LABELS[perm]}</td>
                  {roles.map((r) => {
                    const has = r.permissions.includes(perm);
                    const locked = r.is_system && r.name === 'SUPER_ADMIN';
                    return (
                      <td key={r.id} className="p-3 text-center">
                        <button
                          onClick={() => togglePerm(r, perm)}
                          disabled={locked}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={has
                            ? { background: 'rgb(var(--success-soft))', color: 'rgb(var(--success))' }
                            : { background: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-muted))' }}
                        >
                          {has ? <Check className="w-4 h-4" /> : <X className="w-4 h-4 opacity-30" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {r.is_system ? <Badge variant="info">نظام</Badge> : <Badge>مخصص</Badge>}
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{r.name}</h3>
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{r.description}</p>
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--text-muted))' }}>{r.permissions.length} صلاحية</p>
          </Card>
        ))}
      </div>

      {/* Create Role Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="دور مخصص جديد" maxWidth="max-w-xl">
        <div className="space-y-4">
          <Input label="اسم الدور" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="EDITOR" />
          <Textarea label="الوصف" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
          <div>
            <label className="label">الصلاحيات</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {ALL_PERMISSIONS.filter((p) => p !== 'access_super_admin').map((p) => (
                <label key={p} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ background: newPerms.includes(p) ? 'rgb(var(--accent-soft))' : 'rgb(var(--bg-secondary))' }}>
                  <input type="checkbox" checked={newPerms.includes(p)} onChange={() => {
                    setNewPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
                  }} />
                  <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{PERM_LABELS[p]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={!newName}>إنشاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

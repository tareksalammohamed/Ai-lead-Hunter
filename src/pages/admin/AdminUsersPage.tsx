// ============================================================
// User Management — Create, edit, activate, deactivate, delete, reset password, change role
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getAdminUsers, createAdminUser, updateAdminUser, setAdminUserStatus,
  deleteAdminUser, resetUserPassword, setAdminUserRole, getAdminRoles,
} from '@/lib/admin-services';
import type { AdminUser, RoleDefinition, SystemRole } from '@/types';
import { Card, Button, Input, Select, Modal, EmptyState, Skeleton, Badge } from '@/components/ui';
import {
  Users, Plus, Edit2, Trash2, Key, UserCheck, UserX, Shield, Search,
} from 'lucide-react';

export function AdminUsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showReset, setShowReset] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [u, r] = await Promise.all([getAdminUsers(), getAdminRoles()]);
    setUsers(u);
    setRoles(r);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const handleCreate = async (email: string, fullName: string, role: string, password: string) => {
    if (!user) return;
    try {
      await createAdminUser(user.id, email, fullName, role as SystemRole, password);
      toast('تم إنشاء المستخدم', 'success');
      setShowCreate(false);
      loadData();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleStatus = async (id: string, status: AdminUser['status']) => {
    if (!user) return;
    await setAdminUserStatus(user.id, id, status);
    toast('تم تحديث حالة المستخدم', 'success');
    loadData();
  };

  const handleRole = async (id: string, role: string) => {
    if (!user) return;
    await setAdminUserRole(user.id, id, role as SystemRole);
    toast('تم تغيير الدور', 'success');
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteAdminUser(user.id, id);
      toast('تم حذف المستخدم', 'success');
      setConfirmDelete(null);
      loadData();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleReset = async () => {
    if (!user || !showReset || !newPassword) return;
    await resetUserPassword(user.id, showReset, newPassword);
    toast('تم إعادة تعيين كلمة المرور', 'success');
    setShowReset(null); setNewPassword('');
  };

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>إدارة المستخدمين</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{users.length} مستخدم</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> مستخدم جديد</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
        <input className="input pr-10" placeholder="بحث بالاسم، البريد، الدور..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Users} title="لا يوجد مستخدمون" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgb(var(--bg-secondary))' }}>
                  {['الاسم', 'البريد', 'الدور', 'الحالة', 'آخر دخول', 'تاريخ الإنشاء', 'إجراءات'].map((h) => (
                    <th key={h} className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(var(--bg-secondary))'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: u.role === 'SUPER_ADMIN' ? 'rgb(var(--danger-soft))' : 'rgb(var(--accent-soft))', color: u.role === 'SUPER_ADMIN' ? 'rgb(var(--danger))' : 'rgb(var(--accent))' }}>
                          {u.full_name[0] ?? '?'}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{u.email}</td>
                    <td className="p-3">
                      {u.role === 'SUPER_ADMIN' ? (
                        <Badge variant="danger"><Shield className="w-3 h-3" /> {u.role}</Badge>
                      ) : (
                        <Select value={u.role} onChange={(e) => handleRole(u.id, e.target.value)} className="text-xs py-1">
                          {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </Select>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'default'}>
                        {u.status === 'active' ? 'نشط' : u.status === 'suspended' ? 'موقوف' : 'غير نشط'}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString('ar-EG') : '—'}</td>
                    <td className="p-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{new Date(u.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {u.status === 'active' ? (
                          <button onClick={() => handleStatus(u.id, 'inactive')} className="btn btn-ghost p-1.5" title="إيقاف"><UserX className="w-4 h-4" /></button>
                        ) : (
                          <button onClick={() => handleStatus(u.id, 'active')} className="btn btn-ghost p-1.5" title="تفعيل"><UserCheck className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => setShowReset(u.id)} className="btn btn-ghost p-1.5" title="إعادة تعيين كلمة المرور"><Key className="w-4 h-4" /></button>
                        {u.role !== 'SUPER_ADMIN' && (
                          <button onClick={() => setConfirmDelete(u.id)} className="btn btn-ghost p-1.5" style={{ color: 'rgb(var(--danger))' }} title="حذف"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      {showCreate && <CreateUserModal roles={roles} onCreate={handleCreate} onClose={() => setShowCreate(false)} />}

      {/* Reset Password Modal */}
      <Modal open={!!showReset} onClose={() => { setShowReset(null); setNewPassword(''); }} title="إعادة تعيين كلمة المرور">
        <div className="space-y-4">
          <Input label="كلمة المرور الجديدة" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setShowReset(null); setNewPassword(''); }}>إلغاء</Button>
            <Button onClick={handleReset}>حفظ</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="تأكيد الحذف">
        <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
          <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>حذف</Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateUserModal({ roles, onCreate, onClose }: { roles: RoleDefinition[]; onCreate: (email: string, fullName: string, role: string, password: string) => void; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('USER');
  const [password, setPassword] = useState('');

  return (
    <Modal open={true} onClose={onClose} title="مستخدم جديد">
      <div className="space-y-4">
        <Input label="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="كلمة المرور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <Select label="الدور" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => <option key={r.id} value={r.name}>{r.name} — {r.description}</option>)}
        </Select>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onCreate(email, fullName, role, password)} disabled={!email || !fullName || !password}>إنشاء</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Super Admin Dashboard — KPIs and charts from real data
// ============================================================

import { useState, useEffect } from 'react';
import { getAdminDashboardStats, getAdminUsers, getAdminAuditLogs } from '@/lib/admin-services';
import { Card, Skeleton } from '@/components/ui';
import {
  Users, UserCheck, UserX, Flame, Calendar, Activity, PlayCircle,
  CheckCircle2, XCircle, Plug, Brain, Search, AlertTriangle,
} from 'lucide-react';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAdminDashboardStats>> | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, logs] = await Promise.all([getAdminDashboardStats(), getAdminAuditLogs(10)]);
      setStats(s);
      setRecentLogs(logs);
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const kpis = [
    { label: 'إجمالي المستخدمين', value: stats.totalUsers, icon: Users, color: 'rgb(var(--accent))' },
    { label: 'مستخدمون نشطون', value: stats.activeUsers, icon: UserCheck, color: 'rgb(var(--success))' },
    { label: 'مستخدمون غير نشطون', value: stats.inactiveUsers, icon: UserX, color: 'rgb(var(--text-muted))' },
    { label: 'إجمالي العملاء', value: stats.totalLeads, icon: Flame, color: 'rgb(var(--danger))' },
    { label: 'عملاء اليوم', value: stats.leadsToday, icon: Calendar, color: 'rgb(var(--warning))' },
    { label: 'وكلاء نشطون', value: stats.activeAgents, icon: Activity, color: 'rgb(var(--accent))' },
    { label: 'وظائف قيد التشغيل', value: stats.runningJobs, icon: PlayCircle, color: 'rgb(var(--warning))' },
    { label: 'وظائف مكتملة', value: stats.completedJobs, icon: CheckCircle2, color: 'rgb(var(--success))' },
    { label: 'وظائف فاشلة', value: stats.failedJobs, icon: XCircle, color: 'rgb(var(--danger))' },
    { label: 'مصادر متصلة', value: stats.connectedSources, icon: Plug, color: 'rgb(var(--accent))' },
    { label: 'طلبات AI', value: stats.aiRequests, icon: Brain, color: 'rgb(var(--accent))' },
    { label: 'طلبات البحث', value: stats.searchRequests, icon: Search, color: 'rgb(var(--accent))' },
    { label: 'أخطاء النظام', value: stats.systemErrors, icon: AlertTriangle, color: 'rgb(var(--danger))' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>لوحة تحكم Super Admin</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>نظرة شاملة على أداء النظام</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}20` }}>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{kpi.value}</p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{kpi.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>النشاط الأخير</h3>
          {recentLogs.length > 0 ? (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))' }}>
                    <Activity className="w-3.5 h-3.5" style={{ color: 'rgb(var(--accent))' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--text-primary))' }}>{log.action}</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{new Date(log.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-muted))' }}>لا يوجد نشاط</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>حالة الوظائف</h3>
          <div className="space-y-3">
            <JobBar label="قيد التشغيل" value={stats.runningJobs} total={stats.runningJobs + stats.completedJobs + stats.failedJobs} color="rgb(var(--warning))" />
            <JobBar label="مكتملة" value={stats.completedJobs} total={stats.runningJobs + stats.completedJobs + stats.failedJobs} color="rgb(var(--success))" />
            <JobBar label="فاشلة" value={stats.failedJobs} total={stats.runningJobs + stats.completedJobs + stats.failedJobs} color="rgb(var(--danger))" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function JobBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'rgb(var(--text-secondary))' }}>{label}</span>
        <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{value}</span>
      </div>
      <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

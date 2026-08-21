// ============================================================
// Super Admin Layout — Enterprise Control Center design
// Distinct from regular user app — different sidebar, status header
// ============================================================

import { type ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Shield, ShieldCheck, LayoutDashboard, Users, KeyRound, Settings, Cpu, Brain,
  Search, Plug, Activity, Star, Phone, Copy, Gauge, Flag,
  Bell, HeartPulse, ScrollText, Wrench, Moon, Sun, Menu, X,
  ChevronLeft, AlertTriangle, CheckCircle2, ArrowRight,
} from 'lucide-react';

export type AdminPageKey =
  | 'dashboard' | 'users' | 'roles' | 'settings' | 'ai_providers'
  | 'ai_models' | 'ai_reliability' | 'search_providers' | 'source_connectors' | 'research_engine'
  | 'lead_scoring' | 'phone_rules' | 'duplicate_engine' | 'usage_limits'
  | 'feature_flags' | 'security' | 'notifications' | 'health'
  | 'audit_logs' | 'maintenance';

interface NavItem {
  key: AdminPageKey;
  label: string;
  icon: any;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, group: 'نظرة عامة' },
  { key: 'users', label: 'المستخدمون', icon: Users, group: 'نظرة عامة' },
  { key: 'roles', label: 'الأدوار والصلاحيات', icon: KeyRound, group: 'نظرة عامة' },
  { key: 'settings', label: 'إعدادات النظام', icon: Settings, group: 'التكوين' },
  { key: 'ai_providers', label: 'مزودو AI', icon: Cpu, group: 'التكوين' },
  { key: 'ai_models', label: 'توجيه النماذج', icon: Brain, group: 'التكوين' },
  { key: 'ai_reliability', label: 'مركز اعتمادية AI', icon: ShieldCheck, group: 'المراقبة' },
  { key: 'search_providers', label: 'مزودو البحث', icon: Search, group: 'التكوين' },
  { key: 'source_connectors', label: 'موصلات المصادر', icon: Plug, group: 'التكوين' },
  { key: 'research_engine', label: 'محرك البحث', icon: Activity, group: 'المحركات' },
  { key: 'lead_scoring', label: 'تقييم العملاء', icon: Star, group: 'المحركات' },
  { key: 'phone_rules', label: 'قواعد الهاتف', icon: Phone, group: 'المحركات' },
  { key: 'duplicate_engine', label: 'محرك التكرار', icon: Copy, group: 'المحركات' },
  { key: 'usage_limits', label: 'الاستخدام والحدود', icon: Gauge, group: 'الإدارة' },
  { key: 'feature_flags', label: 'ميزات النظام', icon: Flag, group: 'الإدارة' },
  { key: 'security', label: 'مركز الأمان', icon: Shield, group: 'الإدارة' },
  { key: 'notifications', label: 'الإشعارات', icon: Bell, group: 'الإدارة' },
  { key: 'health', label: 'صحة النظام', icon: HeartPulse, group: 'المراقبة' },
  { key: 'audit_logs', label: 'سجل التدقيق', icon: ScrollText, group: 'المراقبة' },
  { key: 'maintenance', label: 'الصيانة', icon: Wrench, group: 'المراقبة' },
];

interface AdminLayoutProps {
  currentPage: AdminPageKey;
  onNavigate: (page: AdminPageKey) => void;
  onExitAdmin: () => void;
  children: ReactNode;
}

export function AdminLayout({ currentPage, onNavigate, onExitAdmin, children }: AdminLayoutProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'error'>('healthy');

  useEffect(() => {
    // Check system health on mount
    (async () => {
      try {
        const { getSystemHealth } = await import('@/lib/admin-services');
        const checks = await getSystemHealth();
        if (checks.some((c) => c.status === 'error' || c.status === 'offline')) setSystemStatus('error');
        else if (checks.some((c) => c.status === 'warning')) setSystemStatus('warning');
        else setSystemStatus('healthy');
      } catch { setSystemStatus('warning'); }
    })();
  }, []);

  // Group nav items
  const groups = [...new Set(NAV_ITEMS.map((n) => n.group))];

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(var(--bg-primary))' }}>
      {/* Admin Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 right-0 h-screen w-60 flex-shrink-0 z-40 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'rgb(15 23 42)', borderLeft: '1px solid rgb(30 41 59)' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'rgb(30 41 59)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgb(220 38 38)' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-white truncate">Super Admin</h1>
              <p className="text-xs text-slate-400 truncate">مركز التحكم المركزي</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-4">
            {groups.map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold text-slate-500 px-3 mb-1">{group}</p>
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter((n) => n.group === group).map((item) => {
                    const Icon = item.icon;
                    const active = currentPage === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                        style={active
                          ? { background: 'rgb(220 38 38)', color: 'white' }
                          : { color: 'rgb(148 163 184)' }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgb(30 41 59)'; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-right">{item.label}</span>
                        {active && <ChevronLeft className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Exit Admin */}
          <div className="p-3 border-t" style={{ borderColor: 'rgb(30 41 59)' }}>
            <button
              onClick={onExitAdmin}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-slate-400 hover:text-white"
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(30 41 59)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ArrowRight className="w-4 h-4" />
              العودة للتطبيق
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* System Status Header */}
        <header className="flex items-center justify-between p-3 border-b sticky top-0 z-20" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden btn btn-ghost p-2">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
              background: systemStatus === 'healthy' ? 'rgb(var(--success-soft))' :
                systemStatus === 'warning' ? 'rgb(var(--warning-soft))' : 'rgb(var(--danger-soft))',
            }}>
              {systemStatus === 'healthy' && <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(var(--success))' }} />}
              {systemStatus === 'warning' && <AlertTriangle className="w-4 h-4" style={{ color: 'rgb(var(--warning))' }} />}
              {systemStatus === 'error' && <AlertTriangle className="w-4 h-4" style={{ color: 'rgb(var(--danger))' }} />}
              <span className="text-sm font-semibold" style={{
                color: systemStatus === 'healthy' ? 'rgb(var(--success))' :
                  systemStatus === 'warning' ? 'rgb(var(--warning))' : 'rgb(var(--danger))',
              }}>
                {systemStatus === 'healthy' ? 'النظام يعمل بشكل سليم' : systemStatus === 'warning' ? 'تحذيرات في النظام' : 'أخطاء في النظام'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgb(var(--bg-secondary))' }}>
              <Shield className="w-4 h-4" style={{ color: 'rgb(var(--danger))' }} />
              <span className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{user?.email}</span>
            </div>
            <button onClick={toggleTheme} className="btn btn-ghost p-2">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

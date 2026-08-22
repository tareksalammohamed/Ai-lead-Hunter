// ============================================================
// AI Lead Hunter — Main App with routing + Super Admin
// ============================================================

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { AuthPage } from '@/pages/AuthPage';
import { AppLayout, type PageKey } from '@/components/AppLayout';
import { AdminLayout, type AdminPageKey } from '@/components/AdminLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { AgentPage } from '@/pages/AgentPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { LeadProfilePage } from '@/pages/LeadProfilePage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminRolesPage } from '@/pages/admin/AdminRolesPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AdminAIProvidersPage, AdminAIModelsPage } from '@/pages/admin/AdminAIProvidersPage';
import { AdminAIReliabilityPage } from '@/pages/admin/AdminAIReliabilityPage';
import { AdminSearchProvidersPage, AdminSourceConnectorsPage } from '@/pages/admin/AdminSearchSourcesPage';
import { AdminResearchEnginePage, AdminLeadScoringPage, AdminPhoneRulesPage, AdminDuplicateEnginePage } from '@/pages/admin/AdminEnginesPage';
import { AdminUsageLimitsPage, AdminFeatureFlagsPage } from '@/pages/admin/AdminUsageFlagsPage';
import { AdminSecurityPage, AdminAuditLogsPage, AdminHealthPage, AdminNotificationsPage, AdminMaintenancePage } from '@/pages/admin/AdminMonitorPage';
import { isSuperAdmin } from '@/lib/rbac';
import { initAdminData } from '@/lib/admin-services';
import { Loader2, Crosshair } from 'lucide-react';
import { ProductionShell } from '@/components/ProductionShell';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPage, setAdminPage] = useState<AdminPageKey>('dashboard');
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // Check if current user is super admin
  useEffect(() => {
    if (!user) { setAdminAuthorized(false); setAdminMode(false); return; }
    setCheckingAdmin(true);
    (async () => {
      const ok = await isSuperAdmin(user.id);
      setAdminAuthorized(ok);
      if (ok) await initAdminData();
      if (!ok) setAdminMode(false);
      setCheckingAdmin(false);
    })();
  }, [user]);

  // Check URL hash for #super-admin
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#super-admin' && adminAuthorized) {
        setAdminMode(true);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [adminAuthorized]);

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg-primary))' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgb(var(--accent))' }}>
            <Crosshair className="w-9 h-9 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgb(var(--accent))' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // ---- Super Admin Mode ----
  if (adminMode && adminAuthorized) {
    return (
      <AdminLayout
        currentPage={adminPage}
        onNavigate={setAdminPage}
        onExitAdmin={() => { setAdminMode(false); window.location.hash = ''; }}
      >
        {adminPage === 'dashboard' && <AdminDashboardPage />}
        {adminPage === 'users' && <AdminUsersPage />}
        {adminPage === 'roles' && <AdminRolesPage />}
        {adminPage === 'settings' && <AdminSettingsPage />}
        {adminPage === 'ai_providers' && <AdminAIProvidersPage />}
        {adminPage === 'ai_models' && <AdminAIModelsPage />}
        {adminPage === 'ai_reliability' && <AdminAIReliabilityPage />}
        {adminPage === 'search_providers' && <AdminSearchProvidersPage />}
        {adminPage === 'source_connectors' && <AdminSourceConnectorsPage />}
        {adminPage === 'research_engine' && <AdminResearchEnginePage />}
        {adminPage === 'lead_scoring' && <AdminLeadScoringPage />}
        {adminPage === 'phone_rules' && <AdminPhoneRulesPage />}
        {adminPage === 'duplicate_engine' && <AdminDuplicateEnginePage />}
        {adminPage === 'usage_limits' && <AdminUsageLimitsPage />}
        {adminPage === 'feature_flags' && <AdminFeatureFlagsPage />}
        {adminPage === 'security' && <AdminSecurityPage />}
        {adminPage === 'notifications' && <AdminNotificationsPage />}
        {adminPage === 'health' && <AdminHealthPage />}
        {adminPage === 'audit_logs' && <AdminAuditLogsPage />}
        {adminPage === 'maintenance' && <AdminMaintenancePage />}
      </AdminLayout>
    );
  }

  // ---- Regular App Mode ----
  const handleNavigate = (p: PageKey) => {
    setPage(p);
    if (p !== 'agent') setSelectedCampaignId(null);
    if (p !== 'leads') setSelectedLeadId(null);
  };

  const handleSelectCampaign = (id: string) => { setSelectedCampaignId(id); setPage('agent'); };
  const handleSelectLead = (id: string) => setSelectedLeadId(id);

  // Inject admin access button into settings if authorized
  const settingsWithAdmin = adminAuthorized ? (
    <SettingsPage onEnterAdmin={() => { setAdminMode(true); window.location.hash = '#super-admin'; }} />
  ) : (
    <SettingsPage />
  );

  return (
    <AppLayout currentPage={page} onNavigate={handleNavigate}>
      {page === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
      {page === 'campaigns' && <CampaignsPage onNavigate={handleNavigate} onSelectCampaign={handleSelectCampaign} />}
      {page === 'agent' && <AgentPage selectedCampaignId={selectedCampaignId} onNavigate={handleNavigate} />}
      {page === 'leads' && !selectedLeadId && <LeadsPage onSelectLead={handleSelectLead} />}
      {page === 'leads' && selectedLeadId && <LeadProfilePage leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'settings' && settingsWithAdmin}
    </AppLayout>
  );
}

function App() {
  return (
    <ProductionShell>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ProductionShell>
  );
}

export default App;

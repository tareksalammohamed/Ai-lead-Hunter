// ============================================================
// Dashboard — real database metrics and charts
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getCampaigns, getLeads, getJobs } from '@/lib/services';
import type { Campaign, Lead, ResearchJob } from '@/types';
import { Card, Skeleton, EmptyState, ScoreBadge } from '@/components/ui';
import type { PageKey } from '@/components/AppLayout';
import { Users, Flame, CheckCircle2, Calendar, Phone, Activity, TrendingUp, Target, Plus, ArrowLeft } from 'lucide-react';

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [c, l, j] = await Promise.all([
        getCampaigns(user.id),
        getLeads(user.id),
        getJobs(user.id),
      ]);
      setCampaigns(c);
      setLeads(l);
      setJobs(j);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.score_tier === 'HOT').length;
  const verifiedLeads = leads.filter((l) => l.verification_status === 'verified').length;
  const leadsToday = leads.filter((l) => {
    const today = new Date().toISOString().slice(0, 10);
    return l.created_at.slice(0, 10) === today;
  }).length;
  const leadsWithPhone = leads.filter((l) => l.normalized_phone).length;
  const activeResearch = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const completedResearch = jobs.filter((j) => j.status === 'completed').length;

  const stats = [
    { label: 'إجمالي العملاء', value: totalLeads, icon: Users, color: 'rgb(var(--accent))' },
    { label: 'عملاء Hot', value: hotLeads, icon: Flame, color: 'rgb(var(--danger))' },
    { label: 'عملاء موثقون', value: verifiedLeads, icon: CheckCircle2, color: 'rgb(var(--success))' },
    { label: 'عملاء اليوم', value: leadsToday, icon: Calendar, color: 'rgb(var(--warning))' },
    { label: 'عملاء بهاتف', value: leadsWithPhone, icon: Phone, color: 'rgb(var(--accent))' },
    { label: 'بحث نشط', value: activeResearch, icon: Activity, color: 'rgb(var(--warning))' },
    { label: 'بحث مكتمل', value: completedResearch, icon: CheckCircle2, color: 'rgb(var(--success))' },
    { label: 'حملات', value: campaigns.length, icon: Target, color: 'rgb(var(--accent))' },
  ];

  // Charts data
  const leadsBySource = groupBy(leads, (l) => {
    // We'd need lead_sources for accurate data, approximate from first source
    return l.maps_url ? 'google_maps' : 'web_search';
  });
  const leadsByCity = groupBy(leads, (l) => l.city ?? 'غير محدد');
  const leadsByIntent = groupBy(leads, (l) => l.intent);
  const leadsByScore = {
    HOT: leads.filter((l) => l.score_tier === 'HOT').length,
    HIGH: leads.filter((l) => l.score_tier === 'HIGH').length,
    MEDIUM: leads.filter((l) => l.score_tier === 'MEDIUM').length,
    LOW: leads.filter((l) => l.score_tier === 'LOW').length,
  };

  const recentLeads = leads.slice(0, 5);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>لوحة التحكم</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>نظرة عامة على أداء نظام البحث الذكي</p>
        </div>
        <button onClick={() => onNavigate('campaigns')} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          حملة جديدة
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                  <Icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{stat.label}</p>
            </Card>
          );
        })}
      </div>

      {totalLeads === 0 && campaigns.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Target}
            title="ابدأ رحلة البحث الذكي"
            description="أنشئ أول حملة بحث لتبدأ في جمع العملاء المحتملين تلقائياً"
            action={
              <button onClick={() => onNavigate('campaigns')} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                إنشاء حملة
              </button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>العملاء حسب النية</h3>
              {Object.keys(leadsByIntent).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(leadsByIntent).map(([intent, count]) => {
                    const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                    return (
                      <div key={intent}>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: 'rgb(var(--text-secondary))' }}>{intent.replace(/_/g, ' ')}</span>
                          <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'rgb(var(--accent))' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
            </Card>

            <Card className="p-5">
              <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>العملاء حسب النتيجة</h3>
              {totalLeads > 0 ? (
                <div className="space-y-3">
                  {Object.entries(leadsByScore).map(([tier, count]) => {
                    const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                    const colors: Record<string, string> = {
                      HOT: 'rgb(var(--danger))', HIGH: 'rgb(var(--success))',
                      MEDIUM: 'rgb(var(--warning))', LOW: 'rgb(var(--text-muted))',
                    };
                    return (
                      <div key={tier}>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: 'rgb(var(--text-secondary))' }}>{tier}</span>
                          <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colors[tier] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
            </Card>

            <Card className="p-5">
              <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>العملاء حسب المدينة</h3>
              {Object.keys(leadsByCity).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(leadsByCity).slice(0, 6).map(([city, count]) => {
                    const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                    return (
                      <div key={city}>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: 'rgb(var(--text-secondary))' }}>{city}</span>
                          <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'rgb(var(--success))' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
            </Card>

            <Card className="p-5">
              <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>العملاء حسب المصدر</h3>
              {Object.keys(leadsBySource).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(leadsBySource).map(([source, count]) => {
                    const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: 'rgb(var(--text-secondary))' }}>{source.replace(/_/g, ' ')}</span>
                          <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'rgb(var(--warning))' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
            </Card>
          </div>

          {/* Recent leads */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>أحدث العملاء</h3>
              <button onClick={() => onNavigate('leads')} className="text-sm flex items-center gap-1" style={{ color: 'rgb(var(--accent))' }}>
                عرض الكل <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            {recentLeads.length > 0 ? (
              <div className="space-y-2">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                        {lead.name[0] ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--text-primary))' }}>{lead.name}</p>
                        <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>{lead.city ?? 'غير محدد'} · {lead.business ?? 'غير محدد'}</p>
                      </div>
                    </div>
                    <ScoreBadge score={lead.score} tier={lead.score_tier} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-muted))' }}>لا يوجد عملاء بعد</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

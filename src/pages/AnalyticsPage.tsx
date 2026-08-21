// ============================================================
// Analytics — Database-driven analytics
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getLeads, getJobs, getCampaigns, getAIRuns } from '@/lib/services';
import type { Lead, ResearchJob, Campaign, AIRun } from '@/types';
import { Card, Skeleton, EmptyState } from '@/components/ui';
import { BarChart3, TrendingUp, Phone, Target, Copy, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';

export function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [aiRuns, setAIRuns] = useState<AIRun[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [l, j, c, a] = await Promise.all([
        getLeads(user.id), getJobs(user.id), getCampaigns(user.id), getAIRuns(user.id),
      ]);
      setLeads(l); setJobs(j); setCampaigns(c); setAIRuns(a);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" /> <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (leads.length === 0 && campaigns.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="p-8">
          <EmptyState icon={BarChart3} title="لا توجد بيانات للتحليل" description="ابدأ حملة بحث لجمع البيانات" />
        </Card>
      </div>
    );
  }

  const totalLeads = leads.length;
  const phoneAvailability = totalLeads > 0 ? Math.round(leads.filter((l) => l.normalized_phone).length / totalLeads * 100) : 0;
  const verificationRate = totalLeads > 0 ? Math.round(leads.filter((l) => l.verification_status === 'verified').length / totalLeads * 100) : 0;
  const duplicateRate = jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.duplicates_found, 0) / (jobs.reduce((sum, j) => sum + j.records_processed, 0) || 1) * 100) : 0;
  const aiSuccessRate = aiRuns.length > 0 ? Math.round(aiRuns.filter((r) => r.success).length / aiRuns.length * 100) : 0;

  const metrics = [
    { label: 'توفر الهاتف', value: `${phoneAvailability}%`, icon: Phone, color: 'rgb(var(--accent))' },
    { label: 'معدل التحقق', value: `${verificationRate}%`, icon: CheckCircle2, color: 'rgb(var(--success))' },
    { label: 'معدل التكرار', value: `${duplicateRate}%`, icon: Copy, color: 'rgb(var(--warning))' },
    { label: 'نجاح AI', value: `${aiSuccessRate}%`, icon: Cpu, color: 'rgb(var(--accent))' },
  ];

  // Campaign performance
  const campaignPerf = campaigns.map((c) => {
    const cLeads = leads.filter((l) => l.campaign_id === c.id);
    const cJobs = jobs.filter((j) => j.campaign_id === c.id);
    return {
      name: c.name,
      leads: cLeads.length,
      hot: cLeads.filter((l) => l.score_tier === 'HOT').length,
      status: c.status,
      jobs: cJobs.length,
    };
  });

  // Intent distribution
  const intentDist = groupBy(leads, (l) => l.intent);
  // Type distribution
  const typeDist = groupBy(leads, (l) => l.lead_type);
  // City distribution
  const cityDist = groupBy(leads, (l) => l.city ?? 'غير محدد');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>التحليلات</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>تحليل أداء النظام والبيانات</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${m.color}20` }}>
                  <Icon className="w-4 h-4" style={{ color: m.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{m.value}</p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{m.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Campaign performance */}
      <Card className="p-5">
        <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>أداء الحملات</h3>
        {campaignPerf.length > 0 ? (
          <div className="space-y-3">
            {campaignPerf.map((c) => (
              <div key={c.name} className="p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{c.name}</p>
                  <span className="badge" style={{ background: 'rgb(var(--bg-elevated))', color: 'rgb(var(--text-secondary))' }}>{c.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span style={{ color: 'rgb(var(--text-muted))' }}>العملاء: </span><span style={{ color: 'rgb(var(--text-primary))' }}>{c.leads}</span></div>
                  <div><span style={{ color: 'rgb(var(--text-muted))' }}>Hot: </span><span style={{ color: 'rgb(var(--danger))' }}>{c.hot}</span></div>
                  <div><span style={{ color: 'rgb(var(--text-muted))' }}>الوظائف: </span><span style={{ color: 'rgb(var(--text-primary))' }}>{c.jobs}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد حملات</p>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Intent distribution */}
        <Card className="p-5">
          <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>توزيع النية</h3>
          {Object.keys(intentDist).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(intentDist).sort((a, b) => b[1] - a[1]).map(([intent, count]) => {
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={intent}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'rgb(var(--text-secondary))' }}>{intent.replace(/_/g, ' ')}</span>
                      <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'rgb(var(--accent))' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
        </Card>

        {/* Type distribution */}
        <Card className="p-5">
          <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>توزيع النوع</h3>
          {Object.keys(typeDist).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(typeDist).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'rgb(var(--text-secondary))' }}>{type}</span>
                      <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'rgb(var(--success))' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
        </Card>

        {/* City distribution */}
        <Card className="p-5">
          <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>توزيع المدن</h3>
          {Object.keys(cityDist).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([city, count]) => {
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={city}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'rgb(var(--text-secondary))' }}>{city}</span>
                      <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{count}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'rgb(var(--warning))' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد بيانات</p>}
        </Card>

        {/* AI Performance */}
        <Card className="p-5">
          <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>أداء AI</h3>
          {aiRuns.length > 0 ? (
            <div className="space-y-2">
              {groupBy(aiRuns, (r) => r.provider) && Object.entries(groupBy(aiRuns, (r) => r.provider)).map(([provider, count]) => {
                const providerRuns = aiRuns.filter((r) => r.provider === provider);
                const successRate = Math.round(providerRuns.filter((r) => r.success).length / count * 100);
                const avgLatency = Math.round(providerRuns.reduce((s, r) => s + r.latency_ms, 0) / count);
                return (
                  <div key={provider} className="p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{provider}</span>
                      <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{count} تشغيل</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span style={{ color: successRate >= 80 ? 'rgb(var(--success))' : 'rgb(var(--danger))' }}>نجاح: {successRate}%</span>
                      <span style={{ color: 'rgb(var(--text-muted))' }}>متوسط: {avgLatency}ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد تشغيلات AI</p>}
        </Card>
      </div>
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

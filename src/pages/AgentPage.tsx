// ============================================================
// Agent Control Center — Mission execution with live progress
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getCampaign, getJobs, createJob, executeJob, getJobSteps, cancelJob, getJob, generateResearchPlan,
} from '@/lib/services';
import type { Campaign, ResearchJob, ResearchJobStep, JobStepName } from '@/types';
import { Card, Button, EmptyState, Skeleton, ProgressBar, Badge } from '@/components/ui';
import type { PageKey } from '@/components/AppLayout';
import {
  Activity, Play, Square, RefreshCw, Crosshair, CheckCircle2, XCircle,
  Clock, Loader2, AlertCircle, ChevronLeft, Cpu, Database, Search,
  Filter, GitMerge, Copy, Star, Save, Flag, Target,
} from 'lucide-react';

const STEP_ICONS: Record<JobStepName, any> = {
  planning: Crosshair,
  discovery: Search,
  searching: Search,
  extracting: Database,
  normalizing: Filter,
  verifying: CheckCircle2,
  matching: GitMerge,
  deduplicating: Copy,
  scoring: Star,
  qualifying: Flag,
  saving: Save,
  completed: CheckCircle2,
};

const STEP_LABELS: Record<JobStepName, string> = {
  planning: 'التخطيط',
  discovery: 'الاكتشاف',
  searching: 'البحث',
  extracting: 'الاستخراج',
  normalizing: 'التوحيد',
  verifying: 'التحقق',
  matching: 'المطابقة',
  deduplicating: 'إزالة التكرار',
  scoring: 'التقييم',
  qualifying: 'التأهيل',
  saving: 'الحفظ',
  completed: 'مكتمل',
};

export function AgentPage({ selectedCampaignId, onNavigate }: { selectedCampaignId: string | null; onNavigate: (page: PageKey) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [activeJob, setActiveJob] = useState<ResearchJob | null>(null);
  const [steps, setSteps] = useState<ResearchJobStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [plan, setPlan] = useState<ResearchJob['research_plan'] | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [approved, setApproved] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setConsoleLogs((prev) => [...prev, { time: new Date().toLocaleTimeString('ar-EG'), message, type }].slice(-50));
  }, []);

  // Load campaign and jobs
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      if (selectedCampaignId) {
        const c = await getCampaign(user.id, selectedCampaignId);
        setCampaign(c);
        if (c) {
          const p = generateResearchPlan(c);
          setPlan(p);
        }
      }
      const j = await getJobs(user.id);
      setJobs(j);
      setLoading(false);
    })();
  }, [user, selectedCampaignId]);

  // Poll active job
  useEffect(() => {
    if (!user || !activeJob) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const job = await getJob(user.id, activeJob.id);
      if (job) {
        setActiveJob(job);
        const s = await getJobSteps(job.id);
        setSteps(s);
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, activeJob?.id]);

  const handleStart = async () => {
    if (!user || !campaign) return;
    setStarting(true);
    setConsoleLogs([]);
    addLog(`بدء مهمة البحث: ${campaign.name}`, 'info');
    addLog('إنشاء وظيفة بحث جديدة...', 'info');
    const job = await createJob(user.id, campaign);
    setActiveJob(job);
    const s = await getJobSteps(job.id);
    setSteps(s);
    addLog(`تم إنشاء الوظيفة ${job.id.slice(0, 8)}`, 'success');
    setStarting(false);

    // Execute job
    addLog('بدء تنفيذ مراحل البحث...', 'info');
    try {
      await executeJob(user.id, job.id, (updated) => {
        setActiveJob({ ...updated });
        if (updated.status === 'recovering' || updated.recovery_status === 'recovering') addLog('تم حفظ نقطة استعادة وتحويل المهمة إلى نموذج بديل...', 'warning');
        if (updated.recovery_status === 'recovered') addLog('تمت استعادة السياق واستئناف المهمة من آخر خطوة.', 'success');
        addLog(`المرحلة: ${STEP_LABELS[updated.current_step]} — ${updated.records_processed} سجل`, 'info');
      });
      addLog(`اكتمل البحث! تم إنشاء ${job.leads_created} عميل`, 'success');
      toast(`اكتمل البحث! تم إنشاء ${job.leads_created} عميل`, 'success');
      const j = await getJobs(user.id);
      setJobs(j);
    } catch (err: any) {
      const message = String(err?.message ?? '');
      const friendly = message.includes('429') || message.toLowerCase().includes('timeout') || message.toLowerCase().includes('provider')
        ? 'تعذر مزود الذكاء الاصطناعي الحالي؛ تم حفظ حالة المهمة ويمكن استئنافها من آخر نقطة.'
        : `تعذر إكمال البحث: ${message}`;
      addLog(friendly, 'error');
      toast(friendly, 'error');
    }
  };

  const handleStop = async () => {
    if (!user || !activeJob) return;
    await cancelJob(user.id, activeJob.id);
    addLog('تم إيقاف البحث', 'warning');
    toast('تم إيقاف البحث', 'info');
    if (pollRef.current) clearInterval(pollRef.current);
    const j = await getJobs(user.id);
    setJobs(j);
  };

  const handleRetry = async () => {
    if (!user || !campaign) return;
    setActiveJob(null);
    setSteps([]);
    setApproved(false);
    setShowPlan(false);
    await handleStart();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="p-8">
          <EmptyState
            icon={Activity}
            title="اختر حملة لبدء البحث"
            description="اذهب إلى الحملات واختر حملة لتشغيل مركز التحكم"
            action={<Button onClick={() => onNavigate('campaigns')}><ChevronLeft className="w-4 h-4" /> الذهاب إلى الحملات</Button>}
          />
        </Card>
      </div>
    );
  }

  const job = activeJob;
  const isRunning = job?.status === 'running' || starting;
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مركز التحكم</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{campaign.name}</p>
        </div>
        <div className="flex gap-2">
          {!isRunning && !isCompleted && (
            <Button onClick={() => setShowPlan(true)} disabled={starting}>
              <Crosshair className="w-4 h-4" />
              {approved ? 'بدء البحث' : 'مراجعة الخطة'}
            </Button>
          )}
          {isRunning && (
            <Button variant="danger" onClick={handleStop}>
              <Square className="w-4 h-4" />
              إيقاف
            </Button>
          )}
          {(isCompleted || isFailed) && (
            <Button variant="secondary" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4" />
              إعادة
            </Button>
          )}
        </div>
      </div>

      {/* Mission Info */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))' }}>
            <Target className="w-6 h-6" style={{ color: 'rgb(var(--accent))' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold mb-1" style={{ color: 'rgb(var(--text-primary))' }}>المهمة</h3>
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{campaign.objective || campaign.target_audience || 'غير محدد'}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="info">{campaign.city ?? 'غير محدد'}</Badge>
              <Badge>{campaign.keywords.length} كلمات</Badge>
              <Badge>{campaign.sources.length} مصادر</Badge>
              <Badge>حد أقصى: {campaign.max_leads}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress + Steps */}
      {job && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Progress */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>تقدم البحث</h3>
              {job.status === 'running' && (
                <Badge variant="warning"><Loader2 className="w-3 h-3 animate-spin" /> جاري التنفيذ</Badge>
              )}
              {isCompleted && <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> مكتمل</Badge>}
              {isFailed && <Badge variant="danger"><XCircle className="w-3 h-3" /> فشل</Badge>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatBox label="السجلات" value={job.records_processed} total={job.total_records} />
              <StatBox label="العملاء" value={job.leads_created} icon={CheckCircle2} color="rgb(var(--success))" />
              <StatBox label="التكرارات" value={job.duplicates_found} icon={Copy} color="rgb(var(--warning))" />
              <StatBox label="الأخطاء" value={job.records_failed} icon={AlertCircle} color="rgb(var(--danger))" />
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {steps.map((step) => {
                const Icon = STEP_ICONS[step.step_name];
                return (
                  <div key={step.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: step.status === 'running' ? 'rgb(var(--accent-soft))' : 'rgb(var(--bg-secondary))' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                      background: step.status === 'completed' ? 'rgb(var(--success-soft))' :
                        step.status === 'running' ? 'rgb(var(--accent-soft))' :
                        step.status === 'failed' ? 'rgb(var(--danger-soft))' : 'rgb(var(--bg-secondary))',
                    }}>
                      {step.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgb(var(--accent))' }} /> :
                        step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(var(--success))' }} /> :
                        step.status === 'failed' ? <XCircle className="w-4 h-4" style={{ color: 'rgb(var(--danger))' }} /> :
                        <Icon className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: step.status === 'pending' ? 'rgb(var(--text-muted))' : 'rgb(var(--text-primary))' }}>
                        {STEP_LABELS[step.step_name]}
                      </p>
                      {step.records_processed > 0 && (
                        <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{step.records_processed} سجل</p>
                      )}
                    </div>
                    {step.status === 'completed' && step.completed_at && step.started_at && (
                      <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                        {new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()}ms
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Live Console */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>وحدة التحكم المباشرة</h3>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto font-mono text-xs" style={{ background: 'rgb(var(--bg-secondary))', borderRadius: '10px', padding: '12px' }}>
              {consoleLogs.length === 0 ? (
                <p style={{ color: 'rgb(var(--text-muted))' }}>في انتظار البدء...</p>
              ) : (
                consoleLogs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span style={{ color: 'rgb(var(--text-muted))' }}>[{log.time}]</span>
                    <span style={{
                      color: log.type === 'success' ? 'rgb(var(--success))' :
                        log.type === 'error' ? 'rgb(var(--danger))' :
                        log.type === 'warning' ? 'rgb(var(--warning))' : 'rgb(var(--text-secondary))',
                    }}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Research Plan Modal */}
      {showPlan && plan && !approved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowPlan(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>خطة البحث المقترحة</h2>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>راجع الخطة قبل بدء التنفيذ</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: 'rgb(var(--text-primary))' }}>الهدف</h4>
                <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{plan.target}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: 'rgb(var(--text-primary))' }}>المواقع</h4>
                <div className="flex flex-wrap gap-1.5">
                  {plan.locations.length > 0 ? plan.locations.map((l, i) => <Badge key={i} variant="info">{l}</Badge>) : <span className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>غير محدد</span>}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: 'rgb(var(--text-primary))' }}>الكلمات المفتاحية</h4>
                <div className="flex flex-wrap gap-1.5">
                  {plan.keywords.map((k, i) => <Badge key={i}>{k}</Badge>)}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: 'rgb(var(--text-primary))' }}>استعلامات البحث ({plan.search_queries.length})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {plan.search_queries.map((q, i) => (
                    <div key={q.id} className="text-xs p-2 rounded-lg flex items-center gap-2" style={{ background: 'rgb(var(--bg-secondary))' }}>
                      <Search className="w-3 h-3" style={{ color: 'rgb(var(--text-muted))' }} />
                      <span style={{ color: 'rgb(var(--text-secondary))' }}>{q.source}:</span>
                      <span style={{ color: 'rgb(var(--text-primary))' }}>{q.query}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2" style={{ color: 'rgb(var(--text-primary))' }}>معايير التأهيل</h4>
                <ul className="space-y-1">
                  {plan.qualification_criteria.map((c, i) => (
                    <li key={i} className="text-sm flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'rgb(var(--success))' }} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="p-5 border-t flex gap-2 justify-end" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="secondary" onClick={() => setShowPlan(false)}>إلغاء</Button>
              <Button onClick={() => { setApproved(true); setShowPlan(false); handleStart(); }}>
                <Play className="w-4 h-4" />
                الموافقة وبدء البحث
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Previous jobs */}
      {jobs.length > 0 && !job && (
        <Card className="p-5">
          <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>الوظائف السابقة</h3>
          <div className="space-y-2">
            {jobs.slice(0, 5).map((j) => (
              <div key={j.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                    background: j.status === 'completed' ? 'rgb(var(--success-soft))' : j.status === 'failed' ? 'rgb(var(--danger-soft))' : 'rgb(var(--accent-soft))',
                  }}>
                    {j.status === 'completed' ? <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(var(--success))' }} /> :
                      j.status === 'failed' ? <XCircle className="w-4 h-4" style={{ color: 'rgb(var(--danger))' }} /> :
                        <Clock className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{j.id.slice(0, 8)}...</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{new Date(j.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span style={{ color: 'rgb(var(--success))' }}>{j.leads_created} عميل</span>
                  <span style={{ color: 'rgb(var(--warning))' }}>{j.duplicates_found} تكرار</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, total, icon: Icon, color }: { label: string; value: number; total?: number; icon?: any; color?: string }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: color ?? 'rgb(var(--text-muted))' }} />}
        <p className="text-lg font-bold" style={{ color: color ?? 'rgb(var(--text-primary))' }}>{value}{total !== undefined && `/${total}`}</p>
      </div>
      <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{label}</p>
    </div>
  );
}

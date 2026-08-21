// ============================================================
// Service Layer — Data access for all entities
// ============================================================

import type {
  Campaign,
  CampaignInput,
  Lead,
  ResearchJob,
  ResearchJobStep,
  SourceConnection,
  AIProvider,
  SystemSettings,
  Profile,
  AuditLog,
  AIRun,
  RawRecord,
  LeadSource,
  LeadScore,
  LeadIntentRecord,
  LeadMatch,
  LeadDuplicate,
  Source,
  JobStepName,
  JobStepStatus,
} from '@/types';
import {
  dbGetAll,
  dbGet,
  dbPut,
  dbDelete,
  dbBulkPut,
  generateId,
  nowISO,
  type StoreName,
} from './db';
import { scoreLead, extractLeadFromRaw, detectIntent, checkDuplicate, resolveEntities } from './ai-engine';
import { orchestrateAI, saveCheckpoint } from './ai-orchestrator';
import { getConnector, generateSearchQueries } from './connectors';

// ---- Sources (static seed) ----
const SEED_SOURCES: Source[] = [
  { id: 'src-google-maps', code: 'google_maps', name: 'Google Maps', description: 'قوائم الأنشطة التجارية مع الهاتف والعنوان والتقييم', icon: 'MapPin', auth_type: 'api_key', capabilities: ['search', 'extract', 'normalize'], is_active: true },
  { id: 'src-web-search', code: 'web_search', name: 'Web Search', description: 'نتائج محرك البحث عن الأشخاص والأنشطة', icon: 'Globe', auth_type: 'api_key', capabilities: ['search', 'extract', 'normalize'], is_active: true },
  { id: 'src-facebook', code: 'facebook', name: 'Facebook', description: 'الصفحات والمجموعات والمناقشات العامة', icon: 'Facebook', auth_type: 'oauth', capabilities: ['search', 'extract', 'normalize'], is_active: true },
  { id: 'src-linkedin', code: 'linkedin', name: 'LinkedIn', description: 'الملفات الشخصية المهنية وبيانات الشركات', icon: 'Linkedin', auth_type: 'oauth', capabilities: ['search', 'extract', 'normalize'], is_active: true },
  { id: 'src-website', code: 'website', name: 'Website', description: 'استخراج محتوى الموقع مباشرة', icon: 'FileText', auth_type: 'none', capabilities: ['extract', 'normalize'], is_active: true },
];

export async function getSources(): Promise<Source[]> {
  return SEED_SOURCES;
}

// ---- Profiles ----
export async function getProfile(userId: string): Promise<Profile | null> {
  const profiles = await dbGetAll<Profile>('profiles');
  return profiles.find((p) => p.id === userId) ?? null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  const existing = await getProfile(userId);
  const profile: Profile = {
    id: userId,
    full_name: updates.full_name ?? existing?.full_name ?? '',
    avatar_url: updates.avatar_url ?? existing?.avatar_url,
    company: updates.company ?? existing?.company,
    role: updates.role ?? existing?.role,
    preferences: updates.preferences ?? existing?.preferences ?? {},
    created_at: existing?.created_at ?? nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('profiles', profile);
  return profile;
}

// ---- Campaigns ----
export async function getCampaigns(userId: string): Promise<Campaign[]> {
  const all = await dbGetAll<Campaign>('campaigns');
  return all.filter((c) => c.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getCampaign(userId: string, id: string): Promise<Campaign | null> {
  const c = await dbGet<Campaign>('campaigns', id);
  return c && c.user_id === userId ? c : null;
}

export async function createCampaign(userId: string, input: CampaignInput): Promise<Campaign> {
  const campaign: Campaign = {
    id: generateId(),
    user_id: userId,
    name: input.name,
    objective: input.objective,
    country: input.country,
    governorate: input.governorate,
    city: input.city,
    area: input.area,
    keywords: input.keywords,
    negative_keywords: input.negative_keywords,
    target_audience: input.target_audience,
    sources: input.sources,
    max_leads: input.max_leads,
    min_score: input.min_score,
    require_phone: input.require_phone,
    require_egyptian_mobile: input.require_egyptian_mobile,
    ai_instructions: input.ai_instructions,
    status: 'draft',
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('campaigns', campaign);
  await logAudit(userId, 'campaign.create', 'campaign', campaign.id, { name: campaign.name });
  return campaign;
}

export async function updateCampaign(userId: string, id: string, updates: Partial<CampaignInput>): Promise<Campaign | null> {
  const existing = await getCampaign(userId, id);
  if (!existing) return null;
  const updated: Campaign = { ...existing, ...updates, updated_at: nowISO() };
  await dbPut('campaigns', updated);
  await logAudit(userId, 'campaign.update', 'campaign', id, {});
  return updated;
}

export async function duplicateCampaign(userId: string, id: string): Promise<Campaign | null> {
  const existing = await getCampaign(userId, id);
  if (!existing) return null;
  const copy: Campaign = {
    ...existing,
    id: generateId(),
    name: `${existing.name} (نسخة)`,
    status: 'draft',
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('campaigns', copy);
  await logAudit(userId, 'campaign.duplicate', 'campaign', copy.id, { source: id });
  return copy;
}

export async function deleteCampaign(userId: string, id: string): Promise<void> {
  await dbDelete('campaigns', id);
  const jobs = await getJobs(userId);
  for (const job of jobs.filter((j) => j.campaign_id === id)) {
    await dbDelete('research_jobs', job.id);
  }
  const leads = await getLeads(userId);
  for (const lead of leads.filter((l) => l.campaign_id === id)) {
    await dbDelete('leads', lead.id);
  }
  await logAudit(userId, 'campaign.delete', 'campaign', id, {});
}

export async function setCampaignStatus(userId: string, id: string, status: Campaign['status']): Promise<void> {
  const existing = await getCampaign(userId, id);
  if (!existing) return;
  await dbPut('campaigns', { ...existing, status, updated_at: nowISO() });
  await logAudit(userId, 'campaign.status', 'campaign', id, { status });
}

// ---- Source Connections ----
export async function getSourceConnections(userId: string): Promise<SourceConnection[]> {
  const all = await dbGetAll<SourceConnection>('source_connections');
  return all.filter((c) => c.user_id === userId);
}

export async function createSourceConnection(userId: string, sourceId: string, name: string, credentials: Record<string, string>): Promise<SourceConnection> {
  const conn: SourceConnection = {
    id: generateId(),
    user_id: userId,
    source_id: sourceId,
    name,
    credentials,
    status: 'untested',
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('source_connections', conn);
  await logAudit(userId, 'source.connect', 'source_connection', conn.id, { source_id: sourceId });
  return conn;
}

export async function updateSourceConnection(userId: string, id: string, updates: Partial<SourceConnection>): Promise<void> {
  const existing = await dbGet<SourceConnection>('source_connections', id);
  if (!existing || existing.user_id !== userId) return;
  await dbPut('source_connections', { ...existing, ...updates, updated_at: nowISO() });
}

export async function deleteSourceConnection(userId: string, id: string): Promise<void> {
  const existing = await dbGet<SourceConnection>('source_connections', id);
  if (!existing || existing.user_id !== userId) return;
  await dbDelete('source_connections', id);
  await logAudit(userId, 'source.disconnect', 'source_connection', id, {});
}

export async function testSourceConnection(userId: string, id: string): Promise<{ success: boolean; message: string }> {
  const conn = await dbGet<SourceConnection>('source_connections', id);
  if (!conn || conn.user_id !== userId) return { success: false, message: 'الاتصال غير موجود' };
  const source = SEED_SOURCES.find((s) => s.id === conn.source_id);
  if (!source) return { success: false, message: 'المصدر غير موجود' };
  const connector = getConnector(source.code);
  if (!connector) return { success: false, message: 'الموصل غير متوفر' };
  const result = await connector.testConnection(conn.credentials);
  await updateSourceConnection(userId, id, {
    status: result.success ? 'connected' : 'error',
    last_tested_at: nowISO(),
    last_test_result: result.message,
  });
  await logAudit(userId, 'source.test', 'source_connection', id, { success: result.success });
  return result;
}

// ---- AI Providers ----
export async function getAIProviders(userId: string): Promise<AIProvider[]> {
  const all = await dbGetAll<AIProvider>('ai_providers');
  return all.filter((p) => p.user_id === userId).sort((a, b) => a.priority - b.priority);
}

export async function createAIProvider(userId: string, provider: AIProvider['provider'], model: string, apiKey: string, priority: number): Promise<AIProvider> {
  const p: AIProvider = {
    id: generateId(),
    user_id: userId,
    provider,
    model,
    api_key_encrypted: btoa(apiKey),
    priority,
    is_active: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('ai_providers', p);
  await logAudit(userId, 'ai_provider.create', 'ai_provider', p.id, { provider, model });
  return p;
}

export async function updateAIProvider(userId: string, id: string, updates: Partial<AIProvider>): Promise<void> {
  const existing = await dbGet<AIProvider>('ai_providers', id);
  if (!existing || existing.user_id !== userId) return;
  await dbPut('ai_providers', { ...existing, ...updates, updated_at: nowISO() });
}

export async function deleteAIProvider(userId: string, id: string): Promise<void> {
  const existing = await dbGet<AIProvider>('ai_providers', id);
  if (!existing || existing.user_id !== userId) return;
  await dbDelete('ai_providers', id);
  await logAudit(userId, 'ai_provider.delete', 'ai_provider', id, {});
}

// ---- System Settings ----
const DEFAULT_SETTINGS: Omit<SystemSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  scoring_config: {
    weights: { phone: 20, intent: 25, location: 10, business: 15, data_completeness: 10, multiple_sources: 10, source_quality: 5, recency: 5 },
    thresholds: { hot: 80, high: 65, medium: 45 },
  },
  phone_rules: { accept_prefixes: ['010', '011', '012', '015'], international_prefix: '+20', reject_landlines: true },
  duplicate_rules: { exact_phone: true, exact_email: true, exact_social_url: true, exact_website: true, name_business_location: true, fuzzy_threshold: 85 },
  notifications: { job_completed: true, new_leads: true, errors: true },
};

export async function getSettings(userId: string): Promise<SystemSettings> {
  const all = await dbGetAll<SystemSettings>('system_settings');
  const existing = all.find((s) => s.user_id === userId);
  if (existing) return existing;
  const settings: SystemSettings = {
    id: generateId(),
    user_id: userId,
    ...DEFAULT_SETTINGS,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('system_settings', settings);
  return settings;
}

export async function updateSettings(userId: string, updates: Partial<SystemSettings>): Promise<SystemSettings> {
  const existing = await getSettings(userId);
  const updated: SystemSettings = { ...existing, ...updates, updated_at: nowISO() };
  await dbPut('system_settings', updated);
  return updated;
}

// ---- Research Jobs ----
export async function getJobs(userId: string): Promise<ResearchJob[]> {
  const all = await dbGetAll<ResearchJob>('research_jobs');
  return all.filter((j) => j.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getJob(userId: string, id: string): Promise<ResearchJob | null> {
  const j = await dbGet<ResearchJob>('research_jobs', id);
  return j && j.user_id === userId ? j : null;
}

export async function getJobSteps(jobId: string): Promise<ResearchJobStep[]> {
  const all = await dbGetAll<ResearchJobStep>('research_job_steps');
  return all.filter((s) => s.job_id === jobId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateJob(job: ResearchJob): Promise<void> {
  await dbPut('research_jobs', { ...job, updated_at: nowISO() });
}

export async function updateJobStep(step: ResearchJobStep): Promise<void> {
  await dbPut('research_job_steps', step);
}

// ---- Leads ----
export async function getLeads(userId: string): Promise<Lead[]> {
  const all = await dbGetAll<Lead>('leads');
  return all.filter((l) => l.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLead(userId: string, id: string): Promise<Lead | null> {
  const l = await dbGet<Lead>('leads', id);
  return l && l.user_id === userId ? l : null;
}

export async function getLeadSources(leadId: string): Promise<LeadSource[]> {
  const all = await dbGetAll<LeadSource>('lead_sources');
  return all.filter((s) => s.lead_id === leadId);
}

export async function updateLead(userId: string, id: string, updates: Partial<Lead>): Promise<Lead | null> {
  const existing = await getLead(userId, id);
  if (!existing) return null;
  const updated: Lead = { ...existing, ...updates, updated_at: nowISO() };
  await dbPut('leads', updated);
  return updated;
}

export async function deleteLead(userId: string, id: string): Promise<void> {
  const existing = await getLead(userId, id);
  if (!existing || existing.user_id !== userId) return;
  await dbDelete('leads', id);
  const sources = await getLeadSources(id);
  for (const s of sources) await dbDelete('lead_sources', s.id);
  await logAudit(userId, 'lead.delete', 'lead', id, {});
}

// ---- Audit Logs ----
export async function getAuditLogs(userId: string): Promise<AuditLog[]> {
  const all = await dbGetAll<AuditLog>('audit_logs');
  return all.filter((l) => l.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
}

export async function logAudit(userId: string, action: string, entityType: string, entityId?: string, details: Record<string, unknown> = {}): Promise<void> {
  const log: AuditLog = {
    id: generateId(),
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    created_at: nowISO(),
  };
  await dbPut('audit_logs', log);
}

// ---- AI Runs ----
export async function getAIRuns(userId: string): Promise<AIRun[]> {
  const all = await dbGetAll<AIRun>('ai_runs');
  return all.filter((r) => r.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

export async function logAIRun(userId: string, run: Omit<AIRun, 'id' | 'user_id' | 'created_at'>): Promise<void> {
  const r: AIRun = { ...run, id: generateId(), user_id: userId, created_at: nowISO() };
  await dbPut('ai_runs', r);
}

// ---- Raw Records ----
export async function getRawRecords(jobId: string): Promise<RawRecord[]> {
  const all = await dbGetAll<RawRecord>('raw_records');
  return all.filter((r) => r.job_id === jobId);
}

// ---- Research Plan Generation ----
export function generateResearchPlan(campaign: Campaign): ResearchJob['research_plan'] {
  const locations = [campaign.city, campaign.governorate, campaign.area].filter(Boolean) as string[];
  const keywords = campaign.keywords.length > 0 ? campaign.keywords : [campaign.target_audience ?? campaign.objective].filter(Boolean) as string[];

  const searchQueries = generateSearchQueries(keywords, locations, campaign.sources.length > 0 ? campaign.sources : ['web_search']);

  const extractionFields = ['name', 'phone', 'email', 'website', 'address', 'city', 'business', 'rating', 'reviews', 'social_profile'];
  const qualificationCriteria: string[] = [];
  if (campaign.require_phone) qualificationCriteria.push('يجب أن يكون لدى العميل رقم هاتف');
  if (campaign.require_egyptian_mobile) qualificationCriteria.push('يجب أن يكون الرقم موبايل مصري (010/011/012/015)');
  qualificationCriteria.push(`الحد الأدنى للنتيجة: ${campaign.min_score}`);
  if (campaign.target_audience) qualificationCriteria.push(`الجمهور المستهدف: ${campaign.target_audience}`);

  return {
    target: campaign.objective || campaign.target_audience || campaign.name,
    locations,
    keywords,
    negative_keywords: campaign.negative_keywords,
    sources: campaign.sources,
    search_queries: searchQueries,
    extraction_fields: extractionFields,
    qualification_criteria: qualificationCriteria,
    scoring_rules: [
      { factor: 'رقم الهاتف', weight: 20 },
      { factor: 'النية', weight: 25 },
      { factor: 'الموقع', weight: 10 },
      { factor: 'النشاط', weight: 15 },
      { factor: 'اكتمال البيانات', weight: 10 },
      { factor: 'مصادر متعددة', weight: 10 },
      { factor: 'جودة المصدر', weight: 5 },
      { factor: 'الحداثة', weight: 5 },
    ],
  };
}

// ---- Job Execution Engine ----
export const JOB_STEPS: JobStepName[] = [
  'planning', 'discovery', 'searching', 'extracting', 'normalizing',
  'verifying', 'matching', 'deduplicating', 'scoring', 'qualifying', 'saving', 'completed',
];

export async function createJob(userId: string, campaign: Campaign): Promise<ResearchJob> {
  const plan = generateResearchPlan(campaign);
  const job: ResearchJob = {
    id: generateId(),
    user_id: userId,
    campaign_id: campaign.id,
    status: 'queued',
    research_plan: plan,
    total_records: 0,
    records_processed: 0,
    records_failed: 0,
    leads_created: 0,
    duplicates_found: 0,
    current_step: 'planning',
    started_at: nowISO(),
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await dbPut('research_jobs', job);

  const steps: ResearchJobStep[] = JOB_STEPS.map((name, idx) => ({
    id: generateId(),
    job_id: job.id,
    step_name: name,
    status: idx === 0 ? 'running' : 'pending',
    records_processed: 0,
    records_failed: 0,
    started_at: idx === 0 ? nowISO() : undefined,
    created_at: nowISO(),
  }));
  await dbBulkPut('research_job_steps', steps);

  await setCampaignStatus(userId, campaign.id, 'active');
  await logAudit(userId, 'job.create', 'research_job', job.id, { campaign_id: campaign.id });
  return job;
}

async function saveJobCheckpoint(userId: string, job: ResearchJob, step: JobStepName, provider = 'local', model = 'rule-based') {
  try {
    const checkpoint = await saveCheckpoint({
      job_id: job.id,
      task_id: `${job.id}:${step}`,
      step,
      provider,
      model,
      status: 'saved',
      input_context: { campaign_id: job.campaign_id, current_step: job.current_step },
      working_state: {
        mission: job.research_plan.target,
        objective: job.research_plan.target,
        research_plan: job.research_plan,
        current_step: step.toUpperCase(),
        extracted_records: [],
        normalized_records: [],
        candidate_leads: [],
        decisions: [],
        constraints: { user_id: userId },
        remaining_work: JOB_STEPS.slice(JOB_STEPS.indexOf(step) + 1),
        ids: { job_id: job.id, campaign_id: job.campaign_id },
      },
      token_usage: { input_tokens: 0, output_tokens: 0 },
      idempotency_key: `${job.id}:${step}`,
    });
    return checkpoint;
  } catch {
    return null;
  }
}

export async function executeJob(
  userId: string,
  jobId: string,
  onProgress?: (job: ResearchJob) => void
): Promise<ResearchJob> {
  const job = await getJob(userId, jobId);
  if (!job) throw new Error('الوظيفة غير موجودة');
  const campaign = await getCampaign(userId, job.campaign_id);
  if (!campaign) throw new Error('الحملة غير موجودة');
  const settings = await getSettings(userId);
  const connections = await getSourceConnections(userId);
  const existingLeads = await getLeads(userId);

  const steps = await getJobSteps(jobId);
  const updateStep = async (name: JobStepName, updates: Partial<ResearchJobStep>) => {
    const step = steps.find((s) => s.step_name === name);
    if (!step) return;
    const updated = { ...step, ...updates };
    steps[steps.indexOf(step)] = updated;
    await updateJobStep(updated);
  };

  const updateJobState = async (updates: Partial<ResearchJob>) => {
    Object.assign(job, updates, { updated_at: nowISO() });
    await updateJob(job);
    onProgress?.(job);
  };

  try {
    // PLANNING — pass through the central orchestrator; local plan remains the deterministic fallback.
    let planningProvider = 'local'; let planningModel = 'rule-based';
    try {
      const planning = await orchestrateAI({
        task: 'research_planning', task_id: `${jobId}:planning`, job_id: jobId,
        messages: [{ role: 'user', content: `راجع خطة البحث التالية وحافظ على الهدف: ${JSON.stringify(job.research_plan)}` }],
        input_state: { mission: job.research_plan.target, objective: job.research_plan.target, research_plan: job.research_plan, current_step: 'PLANNING', extracted_records: [], normalized_records: [], candidate_leads: [], decisions: [], constraints: {}, remaining_work: JOB_STEPS.slice(1) },
        structured_schema: { type: 'object', properties: { status: { type: 'string' }, next_step: { type: 'string' } } },
        idempotency_key: `${jobId}:planning`,
      });
      planningProvider = planning.provider; planningModel = planning.model;
    } catch { /* Local rule-based plan is the final safe fallback. */ }
    await updateStep('planning', { status: 'completed', completed_at: nowISO(), provider: planningProvider, model: planningModel });
    await saveJobCheckpoint(userId, job, 'planning', planningProvider, planningModel);
    await updateJobState({ current_step: 'discovery' });

    // DISCOVERY
    await updateStep('discovery', { status: 'running', started_at: nowISO() });
    const plan = job.research_plan;
    await updateStep('discovery', { status: 'completed', completed_at: nowISO(), records_processed: plan.search_queries.length });
    await saveJobCheckpoint(userId, job, 'discovery');
    await updateJobState({ current_step: 'searching', total_records: plan.search_queries.length });

    // SEARCHING + EXTRACTING
    await updateStep('searching', { status: 'running', started_at: nowISO() });
    await updateStep('extracting', { status: 'running', started_at: nowISO() });

    const persistedRawRecords = await getRawRecords(jobId);
    const allRawRecords: Omit<RawRecord, 'id' | 'created_at'>[] = persistedRawRecords.length > 0
      ? persistedRawRecords.map((record) => ({ ...record, id: undefined as never, created_at: undefined as never }))
      : [];
    let searchErrors = 0;

    // Resume contract: if raw records were already saved, skip external search entirely.
    if (persistedRawRecords.length === 0) {
      for (const sq of plan.search_queries) {
        const connector = getConnector(sq.source);
        if (!connector) { searchErrors++; continue; }
        const conn = connections.find((c) => {
          const src = SEED_SOURCES.find((s) => s.id === c.source_id);
          return src?.code === sq.source;
        });
        const credentials = conn?.credentials ?? {};
        const result = await connector.search(sq, credentials);
        if (result.error) {
          searchErrors++;
          await logAudit(userId, 'connector.error', 'search_query', sq.id, { source: sq.source, error: result.error });
        }
        for (const rr of result.rawRecords) allRawRecords.push({ ...rr, job_id: jobId });
      }
    }

    await updateStep('searching', { status: 'completed', completed_at: nowISO(), records_processed: persistedRawRecords.length || allRawRecords.length, records_failed: searchErrors });
    await updateStep('extracting', { status: 'completed', completed_at: nowISO(), records_processed: persistedRawRecords.length || allRawRecords.length });
    await updateJobState({ current_step: 'normalizing', total_records: persistedRawRecords.length || allRawRecords.length, records_failed: searchErrors });

    // NORMALIZING
    await updateStep('normalizing', { status: 'running', started_at: nowISO() });
    const rawRecords: RawRecord[] = persistedRawRecords.length > 0
      ? persistedRawRecords
      : allRawRecords.map((rr) => ({ ...rr, id: generateId(), created_at: nowISO() })) as RawRecord[];
    if (persistedRawRecords.length === 0) await dbBulkPut('raw_records', rawRecords);
    await updateStep('normalizing', { status: 'completed', completed_at: nowISO(), records_processed: rawRecords.length });
    await saveJobCheckpoint(userId, job, 'normalizing');
    await updateJobState({ current_step: 'verifying', records_processed: rawRecords.length });

    // VERIFYING + MATCHING + DEDUPLICATING + SCORING + QUALIFYING + SAVING
    const leadsToCreate: Lead[] = [];
    let duplicates = 0;
    let verified = 0;

    for (const raw of rawRecords) {
      const extracted = extractLeadFromRaw(raw);

      // Phone verification
      if (campaign.require_phone && !extracted.normalized_phone) continue;
      if (campaign.require_egyptian_mobile) {
        const isMobile = extracted.phone_type === 'mobile';
        if (!isMobile) continue;
      }
      if (extracted.verification_status === 'verified') verified++;

      // Deduplication — do not create a child row with an empty lead_id.
      const dupResult = checkDuplicate(extracted, existingLeads.concat(leadsToCreate), settings.duplicate_rules);
      if (dupResult.isDuplicate) {
        duplicates++;
        await logAudit(userId, 'lead.duplicate', 'lead', dupResult.duplicateOfId, { rule: dupResult.rule, job_id: jobId });
        continue;
      }

      // Entity resolution
      let bestMatch: { score: number; factors: string[]; leadId: string } | null = null;
      for (const existing of existingLeads.concat(leadsToCreate)) {
        const match = resolveEntities(extracted, existing);
        if (match.match_score >= 60 && (!bestMatch || match.match_score > bestMatch.score)) {
          bestMatch = { score: match.match_score, factors: match.match_factors, leadId: existing.id };
        }
      }

      // Scoring
      const scoreResult = scoreLead(extracted, settings.scoring_config, 1);

      // Intent
      let intent = detectIntent(`${raw.data.content ?? ''} ${extracted.business ?? ''}`);
      try {
        const aiIntent = await orchestrateAI({
          task: 'intent_detection', task_id: `${jobId}:intent:${raw.id}`, job_id: jobId,
          messages: [{ role: 'user', content: `حلل نية العميل وأعد JSON: ${String(raw.data.content ?? '')}` }],
          input_state: { mission: campaign.objective, objective: campaign.objective, current_step: 'QUALIFYING', extracted_records: [raw], normalized_records: [extracted], candidate_leads: [], decisions: [], constraints: {}, remaining_work: ['SCORING', 'SAVING'] },
          structured_schema: { type: 'object', properties: { intent: { type: 'string' }, intent_score: { type: 'number' }, confidence: { type: 'number' }, potential: { type: 'string' } } },
          idempotency_key: `${jobId}:intent:${raw.id}`,
        });
        const structured = aiIntent.structured;
        if (aiIntent.success && structured && typeof structured.intent === 'string') {
          intent = { ...intent, intent: structured.intent as typeof intent.intent, intent_score: Number(structured.intent_score ?? intent.intent_score), confidence: Number(structured.confidence ?? intent.confidence), potential: String(structured.potential ?? intent.potential), reason: 'تم تحليل النية عبر Smart AI Router' };
        }
      } catch { /* deterministic intent detection remains the fallback */ }

      if (scoreResult.score < campaign.min_score) continue;
      if (leadsToCreate.length >= campaign.max_leads) break;

      const lead: Lead = {
        id: generateId(),
        user_id: userId,
        campaign_id: campaign.id,
        name: extracted.name ?? 'غير معروف',
        business: extracted.business,
        raw_phone: extracted.raw_phone,
        normalized_phone: extracted.normalized_phone,
        phone_type: extracted.phone_type,
        email: extracted.email,
        website: extracted.website,
        address: extracted.address,
        city: extracted.city,
        governorate: extracted.governorate,
        country: extracted.country ?? 'Egypt',
        rating: extracted.rating,
        reviews_count: extracted.reviews_count,
        maps_url: extracted.maps_url,
        social_profiles: extracted.social_profiles ?? [],
        score: scoreResult.score,
        score_tier: scoreResult.tier,
        lead_type: intent.lead_type,
        intent: intent.intent,
        intent_score: intent.intent_score,
        intent_reason: intent.reason,
        confidence: intent.confidence,
        potential: intent.potential,
        verification_status: extracted.verification_status ?? 'unverified',
        status: 'new',
        match_score: bestMatch?.score,
        created_at: nowISO(),
        updated_at: nowISO(),
      };

      leadsToCreate.push(lead);
      existingLeads.push(lead);
      // Persist each lead before the next AI operation so a timeout/failure resumes without losing partial results.
      await dbPut('leads', lead);

      // Save lead source
      const leadSource: LeadSource = {
        id: generateId(),
        lead_id: lead.id,
        source_code: raw.source_code,
        source_url: raw.source_url ?? '',
        source_type: String(raw.data.source_type ?? 'unknown'),
        author: String(raw.data.author ?? ''),
        context: String(raw.data.content ?? '').slice(0, 500),
        date: nowISO(),
        raw_data: raw.data,
        created_at: nowISO(),
      };
      await dbPut('lead_sources', leadSource);

      // Save score record
      const scoreRecord: LeadScore = {
        id: generateId(),
        lead_id: lead.id,
        score: scoreResult.score,
        tier: scoreResult.tier,
        factors: scoreResult.factors,
        created_at: nowISO(),
      };
      await dbPut('lead_scores', scoreRecord);

      // Save intent record
      const intentRecord: LeadIntentRecord = {
        id: generateId(),
        lead_id: lead.id,
        intent: intent.intent,
        intent_score: intent.intent_score,
        reason: intent.reason,
        confidence: intent.confidence,
        potential: intent.potential,
        created_at: nowISO(),
      };
      await dbPut('lead_intents', intentRecord);

      // Save match record
      if (bestMatch) {
        const matchRecord: LeadMatch = {
          id: generateId(),
          lead_id: lead.id,
          matched_lead_id: bestMatch.leadId,
          match_score: bestMatch.score,
          match_factors: bestMatch.factors,
          merged: false,
          created_at: nowISO(),
        };
        await dbPut('lead_matches', matchRecord);
      }
    }

    await dbBulkPut('leads', leadsToCreate);
    await saveJobCheckpoint(userId, job, 'saving');

    // Complete remaining steps
    await updateStep('verifying', { status: 'completed', completed_at: nowISO(), records_processed: verified });
    await updateStep('matching', { status: 'completed', completed_at: nowISO(), records_processed: leadsToCreate.length });
    await updateStep('deduplicating', { status: 'completed', completed_at: nowISO(), records_processed: duplicates });
    await updateStep('scoring', { status: 'completed', completed_at: nowISO(), records_processed: leadsToCreate.length });
    await updateStep('qualifying', { status: 'completed', completed_at: nowISO(), records_processed: leadsToCreate.length });
    await updateStep('saving', { status: 'completed', completed_at: nowISO(), records_processed: leadsToCreate.length });
    await updateStep('completed', { status: 'completed', completed_at: nowISO() });

    await updateJobState({
      current_step: 'completed',
      status: 'completed',
      records_processed: rawRecords.length,
      leads_created: leadsToCreate.length,
      duplicates_found: duplicates,
      completed_at: nowISO(),
    });

    await setCampaignStatus(userId, campaign.id, 'completed');
    await logAudit(userId, 'job.complete', 'research_job', jobId, { leads: leadsToCreate.length, duplicates });

    return job;
  } catch (err: any) {
    await updateJobState({ status: 'recovering', recovery_status: 'recovering', error: err.message });
    await saveJobCheckpoint(userId, job, job.current_step);
    await updateJobState({ status: 'failed', recovery_status: 'failed', error: err.message });
    await logAudit(userId, 'job.failed', 'research_job', jobId, { error: err.message });
    throw err;
  }
}

export async function cancelJob(userId: string, jobId: string): Promise<void> {
  const job = await getJob(userId, jobId);
  if (!job) return;
  await updateJob({ ...job, status: 'cancelled', completed_at: nowISO() });
  await logAudit(userId, 'job.cancel', 'research_job', jobId, {});
}

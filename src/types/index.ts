// ============================================================
// AI Lead Hunter — Type Definitions
// ============================================================

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type SourceCode = 'google_maps' | 'web_search' | 'facebook' | 'linkedin' | 'website';

export type JobStatus = 'queued' | 'running' | 'recovering' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type JobStepName =
  | 'planning'
  | 'discovery'
  | 'searching'
  | 'extracting'
  | 'normalizing'
  | 'verifying'
  | 'matching'
  | 'deduplicating'
  | 'scoring'
  | 'qualifying'
  | 'saving'
  | 'completed';

export type JobStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type LeadType =
  | 'Insurance'
  | 'Savings'
  | 'Investment'
  | 'Retirement'
  | 'Education'
  | 'Family Protection'
  | 'Business Owner'
  | 'Other';

export type LeadIntent =
  | 'FAMILY_PROTECTION'
  | 'WEALTH_BUILDING'
  | 'BUSINESS_GROWTH'
  | 'RETIREMENT_PLANNING'
  | 'EDUCATION_SAVING'
  | 'RISK_COVERAGE'
  | 'INVESTMENT_INTEREST'
  | 'GENERAL_FINANCIAL'
  | 'UNKNOWN';

export type ScoreTier = 'HOT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified' | 'converted';

export type VerificationStatus = 'verified' | 'unverified' | 'invalid' | 'partial';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'untested';

export type AIProviderCode = 'openrouter' | 'openai' | 'gemini' | 'anthropic' | 'huggingface' | 'grok' | 'groq' | 'cerebras' | 'mistral';

// ============================================================
// Profile
// ============================================================
export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  company?: string;
  role?: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Campaign
// ============================================================
export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  objective: string;
  country: string;
  governorate?: string;
  city?: string;
  area?: string;
  keywords: string[];
  negative_keywords: string[];
  target_audience?: string;
  sources: SourceCode[];
  max_leads: number;
  min_score: number;
  require_phone: boolean;
  require_egyptian_mobile: boolean;
  ai_instructions?: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface CampaignInput {
  name: string;
  objective: string;
  country: string;
  governorate?: string;
  city?: string;
  area?: string;
  keywords: string[];
  negative_keywords: string[];
  target_audience?: string;
  sources: SourceCode[];
  max_leads: number;
  min_score: number;
  require_phone: boolean;
  require_egyptian_mobile: boolean;
  ai_instructions?: string;
}

// ============================================================
// Source
// ============================================================
export interface Source {
  id: string;
  code: SourceCode;
  name: string;
  description: string;
  icon: string;
  auth_type: string;
  capabilities: string[];
  is_active: boolean;
}

export interface SourceConnection {
  id: string;
  user_id: string;
  source_id: string;
  source_code?: SourceCode;
  name: string;
  credentials: Record<string, string>;
  status: ConnectionStatus;
  last_tested_at?: string;
  last_test_result?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// AI Provider
// ============================================================
export interface AIProvider {
  id: string;
  user_id: string;
  provider: AIProviderCode;
  model: string;
  api_key_encrypted?: string;
  priority: number;
  is_active: boolean;
  last_used_at?: string;
  last_error?: string;
  last_latency_ms?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// System Settings
// ============================================================
export interface ScoringConfig {
  weights: {
    phone: number;
    intent: number;
    location: number;
    business: number;
    data_completeness: number;
    multiple_sources: number;
    source_quality: number;
    recency: number;
  };
  thresholds: {
    hot: number;
    high: number;
    medium: number;
  };
}

export interface PhoneRules {
  accept_prefixes: string[];
  international_prefix: string;
  reject_landlines: boolean;
}

export interface DuplicateRules {
  exact_phone: boolean;
  exact_email: boolean;
  exact_social_url: boolean;
  exact_website: boolean;
  name_business_location: boolean;
  fuzzy_threshold: number;
}

export interface SystemSettings {
  id: string;
  user_id: string;
  scoring_config: ScoringConfig;
  phone_rules: PhoneRules;
  duplicate_rules: DuplicateRules;
  notifications: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Research Job
// ============================================================
export interface ResearchJob {
  id: string;
  user_id: string;
  campaign_id: string;
  status: JobStatus;
  research_plan: ResearchPlan;
  total_records: number;
  records_processed: number;
  records_failed: number;
  leads_created: number;
  duplicates_found: number;
  current_step: JobStepName;
  error?: string;
  recovery_status?: 'idle' | 'recovering' | 'recovered' | 'failed';
  active_task_id?: string;
  last_checkpoint_id?: string;
  context_snapshot?: Record<string, unknown>;
  resume_count?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchJobStep {
  id: string;
  job_id: string;
  step_name: JobStepName;
  status: JobStepStatus;
  records_processed: number;
  records_failed: number;
  error?: string;
  provider?: string;
  model?: string;
  ai_task_id?: string;
  checkpoint_id?: string;
  input_state?: Record<string, unknown>;
  output_state?: Record<string, unknown>;
  next_step?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ============================================================
// Research Plan
// ============================================================
export interface ResearchPlan {
  target: string;
  locations: string[];
  keywords: string[];
  negative_keywords: string[];
  sources: SourceCode[];
  search_queries: SearchQuery[];
  extraction_fields: string[];
  qualification_criteria: string[];
  scoring_rules: { factor: string; weight: number }[];
}

export interface SearchQuery {
  id: string;
  source: SourceCode;
  query: string;
  location?: string;
}

// ============================================================
// Lead
// ============================================================
export interface Lead {
  id: string;
  user_id: string;
  campaign_id: string;
  name: string;
  business?: string;
  raw_phone?: string;
  normalized_phone?: string;
  phone_type?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  governorate?: string;
  country?: string;
  rating?: number;
  reviews_count?: number;
  maps_url?: string;
  coordinates?: { lat: number; lng: number };
  social_profiles: SocialProfile[];
  score: number;
  score_tier: ScoreTier;
  lead_type: LeadType;
  intent: LeadIntent;
  intent_score: number;
  intent_reason?: string;
  confidence: number;
  potential: string;
  verification_status: VerificationStatus;
  status: LeadStatus;
  match_score?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialProfile {
  platform: string;
  url: string;
  handle?: string;
}

export interface LeadContact {
  id: string;
  lead_id: string;
  type: 'phone' | 'email' | 'website' | 'social';
  value: string;
  normalized_value?: string;
  is_primary: boolean;
  verified: boolean;
  created_at: string;
}

export interface LeadSource {
  id: string;
  lead_id: string;
  source_code: SourceCode;
  source_url: string;
  source_type: string;
  author?: string;
  context?: string;
  date?: string;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface LeadScore {
  id: string;
  lead_id: string;
  score: number;
  tier: ScoreTier;
  factors: { factor: string; points: number; max: number }[];
  created_at: string;
}

export interface LeadIntentRecord {
  id: string;
  lead_id: string;
  intent: LeadIntent;
  intent_score: number;
  reason: string;
  confidence: number;
  potential: string;
  created_at: string;
}

export interface LeadMatch {
  id: string;
  lead_id: string;
  matched_lead_id: string;
  match_score: number;
  match_factors: string[];
  merged: boolean;
  created_at: string;
}

export interface LeadDuplicate {
  id: string;
  lead_id: string;
  duplicate_lead_id: string;
  rule: string;
  created_at: string;
}

// ============================================================
// Raw Record (pre-normalization)
// ============================================================
export interface RawRecord {
  id: string;
  job_id: string;
  source_code: SourceCode;
  source_url?: string;
  data: Record<string, unknown>;
  normalized: boolean;
  created_at: string;
}

// ============================================================
// AI Run
// ============================================================
export interface AIRun {
  id: string;
  user_id: string;
  job_id?: string;
  lead_id?: string;
  provider: AIProviderCode;
  model: string;
  task: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: boolean;
  error?: string;
  attempt?: number;
  error_type?: AIErrorType;
  fallback_from?: string;
  fallback_to?: string;
  checkpoint_id?: string;
  idempotency_key?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ============================================================
// Audit Log
// ============================================================
export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Super Admin — RBAC, Users, Config, Feature Flags, Health
// ============================================================

export type SystemRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'RESEARCHER' | 'USER';

export type Permission =
  | 'view_dashboard'
  | 'create_campaign'
  | 'run_agent'
  | 'view_leads'
  | 'edit_leads'
  | 'delete_leads'
  | 'export_leads'
  | 'manage_sources'
  | 'manage_ai'
  | 'manage_users'
  | 'manage_settings'
  | 'view_analytics'
  | 'view_audit_logs'
  | 'manage_billing'
  | 'access_super_admin';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: SystemRole;
  status: 'active' | 'inactive' | 'suspended';
  last_login?: string;
  created_at: string;
  updated_at: string;
  permissions: Permission[];
  usage: {
    daily_searches: number;
    monthly_searches: number;
    daily_leads: number;
    monthly_leads: number;
    ai_requests: number;
    export_count: number;
    active_jobs: number;
  };
  limits: {
    max_daily_searches: number;
    max_monthly_searches: number;
    max_daily_leads: number;
    max_monthly_leads: number;
    max_ai_requests: number;
    max_exports: number;
    max_active_jobs: number;
  };
}

export interface RoleDefinition {
  id: string;
  name: SystemRole | string;
  description: string;
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export type ConfigSection =
  | 'general' | 'application' | 'research' | 'ai' | 'search'
  | 'leads' | 'security' | 'notifications' | 'limits';

export interface SystemConfig {
  key: string;
  section: ConfigSection;
  name: string;
  description: string;
  value: string | number | boolean;
  default_value: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'json';
  updated_at: string;
  updated_by: string;
}

export interface ConfigChange {
  id: string;
  key: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
}

export interface AdminAIProvider {
  id: string;
  provider: AIProviderCode;
  enabled: boolean;
  api_key_masked: string;
  base_url?: string;
  priority: number;
  default_model: string;
  fallback_enabled: boolean;
  max_requests: number;
  timeout_ms: number;
  retry_count: number;
  updated_at: string;
  openrouter_auto_mode?: boolean;
  model_fallback_chain?: string[];
  capabilities?: string[];
  cooldown_ms?: number;
  daily_limit?: number;
  routing_mode?: AIRoutingMode;
  api_key_encrypted?: string;
  has_key?: boolean;
}

export interface AIModelRouter {
  task: AITaskType | 'research_planning' | 'data_extraction' | 'intent_detection' | 'lead_scoring' | 'entity_matching' | 'summarization';
  primary_model: string;
  secondary_model: string;
  fallback_model: string;
}

export interface AdminSearchProvider {
  id: string;
  name: string;
  enabled: boolean;
  api_key_masked: string;
  priority: number;
  daily_limit: number;
  requests_per_minute: number;
  timeout_ms: number;
  fallback_enabled: boolean;
  updated_at: string;
}

export interface AdminSourceConnector {
  code: SourceCode;
  name: string;
  enabled: boolean;
  available: boolean;
  auth_type: string;
  api_status: 'healthy' | 'warning' | 'error' | 'offline';
  last_test?: string;
  usage_count: number;
  limits: { max_per_day: number; max_per_hour: number };
}

export interface ResearchEngineConfig {
  max_concurrent_jobs: number;
  max_leads_per_job: number;
  max_search_depth: number;
  request_timeout_ms: number;
  retry_attempts: number;
  delay_between_requests_ms: number;
  daily_research_limit: number;
  max_sources_per_campaign: number;
  ai_qualification_threshold: number;
}

export interface AdminScoringConfig {
  weights: {
    phone: number;
    intent: number;
    location: number;
    business: number;
    multiple_sources: number;
    data_completeness: number;
    source_quality: number;
    recency: number;
  };
  thresholds: { hot: number; high: number; medium: number };
}

export interface IntentCategory {
  id: string;
  name: string;
  description: string;
  ai_instructions: string;
  weight: number;
  enabled: boolean;
}

export interface AdminPhoneRules {
  country_code: string;
  mobile_prefixes: string[];
  require_mobile: boolean;
  allow_landline: boolean;
  verify_format: boolean;
  normalize_automatically: boolean;
  reject_invalid: boolean;
}

export interface DuplicateEngineConfig {
  phone_match_weight: number;
  email_match_weight: number;
  name_match_weight: number;
  business_match_weight: number;
  location_match_weight: number;
  website_match_weight: number;
  auto_merge_threshold: number;
  potential_duplicate_threshold: number;
  keep_separate_threshold: number;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  scope: 'global' | 'role' | 'user';
  target_roles?: SystemRole[];
  target_user_ids?: string[];
  updated_at: string;
}

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'offline';

export interface SystemHealthCheck {
  component: string;
  status: HealthStatus;
  latency_ms: number;
  error_rate: number;
  last_check: string;
  message?: string;
}

export interface SecurityEvent {
  id: string;
  type: 'failed_login' | 'password_reset' | 'api_error' | 'suspicious_activity' | 'token_expired' | 'force_logout' | 'account_disabled';
  user_id?: string;
  user_email?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export interface AdminNotificationConfig {
  key: string;
  name: string;
  enabled: boolean;
  recipients: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MaintenanceOperation {
  id: string;
  operation: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  result?: string;
  initiated_by: string;
}

// ============================================================
// Smart AI Router & Failover
// ============================================================

export type AIErrorType =
  | 'RATE_LIMIT' | 'TIMEOUT' | 'NETWORK_ERROR' | 'PROVIDER_DOWN'
  | 'MODEL_UNAVAILABLE' | 'MODEL_DEPRECATED' | 'CONTEXT_TOO_LONG'
  | 'INVALID_REQUEST' | 'AUTH_ERROR' | 'QUOTA_EXCEEDED'
  | 'CONTENT_POLICY' | 'UNKNOWN';

export type AIRoutingMode = 'SMART_AUTO' | 'AUTOMATIC' | 'MANUAL' | 'FREE_FIRST' | 'RELIABILITY_FIRST' | 'COST_FIRST' | 'SPEED_FIRST';
export type AIProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'OFFLINE' | 'DISABLED';
export type AIModelHealthStatus = 'ACTIVE' | 'COOLDOWN' | 'DISABLED' | 'DEPRECATED';
export type AITaskType =
  | 'research_planning' | 'query_generation' | 'data_extraction' | 'intent_detection'
  | 'lead_scoring' | 'entity_matching' | 'deduplication' | 'summarization'
  | 'lead_qualification' | 'agent_reasoning';
export type AgentState = 'PLANNING' | 'SEARCHING' | 'EXTRACTING' | 'NORMALIZING' | 'VERIFYING' | 'MATCHING' | 'DEDUPLICATING' | 'SCORING' | 'QUALIFYING' | 'SAVING' | 'COMPLETED';

export interface CanonicalTaskState {
  mission: string;
  objective: string;
  research_plan?: ResearchPlan;
  current_step: AgentState | string;
  extracted_records: RawRecord[];
  normalized_records: Partial<Lead>[];
  candidate_leads: Partial<Lead>[];
  decisions: Record<string, unknown>[];
  constraints: Record<string, unknown>;
  remaining_work: string[];
  user_instructions?: string;
  ids?: Record<string, string>;
}

export interface AIRequestMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface AIUsage { input_tokens: number; output_tokens: number; total_tokens?: number; estimated_cost_usd?: number; }

export interface AIOrchestratorRequest {
  task: AITaskType | string;
  task_id: string;
  job_id?: string;
  lead_id?: string;
  messages: AIRequestMessage[];
  input_state?: CanonicalTaskState;
  required_capabilities?: string[];
  structured_schema?: Record<string, unknown>;
  max_tokens?: number;
  temperature?: number;
  idempotency_key?: string;
  simulate?: 'openrouter_failure' | 'gemini_failure' | 'timeout' | 'context_too_long';
}

export interface AIOrchestratorResponse {
  success: boolean;
  content: string;
  structured?: Record<string, unknown>;
  provider: AIProviderCode | string;
  model: string;
  latency_ms: number;
  usage: AIUsage;
  error?: string;
  error_type?: AIErrorType;
  checkpoint_id?: string;
  task_id: string;
  current_step?: string;
  next_step?: string;
  recovered?: boolean;
  events?: string[];
}

export interface AITaskCheckpoint {
  id: string;
  job_id?: string;
  task_id: string;
  step: string;
  provider?: string;
  model?: string;
  status: 'saved' | 'current' | 'completed' | 'failed';
  input_context: Record<string, unknown>;
  working_state: CanonicalTaskState;
  output?: string;
  structured_result?: Record<string, unknown>;
  token_usage: AIUsage;
  idempotency_key?: string;
  created_at: string;
}

export interface AIProviderHealth {
  id: string;
  provider: AIProviderCode | string;
  status: AIProviderHealthStatus;
  success_rate: number;
  failure_rate: number;
  average_latency_ms: number;
  consecutive_failures: number;
  recent_errors: { type: AIErrorType; message: string; at: string }[];
  last_success_at?: string;
  last_failure_at?: string;
  requests_count: number;
  updated_at: string;
}

export interface AIModelHealth {
  id: string;
  provider: string;
  model: string;
  status: AIModelHealthStatus;
  success_rate: number;
  failure_rate: number;
  average_latency_ms: number;
  requests_count: number;
  fallback_count: number;
  last_error?: string;
  last_used_at?: string;
  last_failure_at?: string;
  cooldown_until?: string;
  capabilities: string[];
  context_length: number;
  is_free: boolean;
  updated_at: string;
}

export interface AIRoutingRule {
  id: string;
  task: AITaskType | string;
  provider_order: string[];
  model_order: string[];
  required_capabilities: string[];
  enabled: boolean;
  updated_at: string;
}

export interface AIRoutingEvent {
  id: string;
  task_id: string;
  job_id?: string;
  task: string;
  event_type: 'attempt' | 'failure' | 'checkpoint_saved' | 'provider_switched' | 'context_compressed' | 'context_restored' | 'completed' | 'recovery_failed';
  from_provider?: string;
  from_model?: string;
  to_provider?: string;
  to_model?: string;
  error_type?: AIErrorType;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AICircuitBreaker {
  id: string;
  provider: string;
  model?: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failure_threshold: number;
  consecutive_failures: number;
  cooldown_ms: number;
  opened_at?: string;
  next_probe_at?: string;
  updated_at: string;
}

export interface AIReliabilitySettings {
  routing_mode: AIRoutingMode;
  smart_routing: boolean;
  openrouter_enabled: boolean;
  openrouter_free_enabled: boolean;
  openrouter_auto_mode: boolean;
  dynamic_free_model_discovery: boolean;
  global_failover: boolean;
  context_preservation: boolean;
  checkpointing: boolean;
  auto_retry: boolean;
  circuit_breaker: boolean;
  model_health: boolean;
  provider_health: boolean;
  cost_control: boolean;
  max_retries: number;
  retry_delay_ms: number;
  max_cooldown_ms: number;
  circuit_failure_threshold: number;
  daily_ai_budget_usd: number;
  monthly_ai_budget_usd: number;
  stop_paid_fallback_on_budget: boolean;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  canonical_slug?: string;
  context_length: number;
  pricing: Record<string, string>;
  architecture: Record<string, unknown>;
  supported_parameters: string[];
  top_provider?: Record<string, unknown>;
  expiration_date?: string | null;
  is_free: boolean;
  provider_name?: string;
  availability?: string;
}

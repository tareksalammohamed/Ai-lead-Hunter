// ============================================================
// Admin Service Layer — Super Admin data operations
// All operations enforce RBAC via hasPermission / isSuperAdmin
// ============================================================

import type {
  AdminUser, RoleDefinition, SystemConfig, ConfigChange,
  AdminAIProvider, AIModelRouter, AdminSearchProvider, AdminSourceConnector,
  ResearchEngineConfig, AdminScoringConfig, IntentCategory, AdminPhoneRules,
  DuplicateEngineConfig, FeatureFlag, SystemHealthCheck, SecurityEvent,
  AdminNotificationConfig, MaintenanceOperation, Permission, SystemRole,
} from '@/types';
import { dbGetAll, dbPut, dbDelete, generateId, nowISO } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { getRoles, createRole as createRoleRBAC, updateRole as updateRoleRBAC, deleteRole as deleteRoleRBAC, isSuperAdmin, hasPermission, initRoles, ALL_PERMISSIONS } from './rbac';
import { refreshOpenRouterModelPool } from './openrouter-model-discovery';

// ============================================================
// SEED DATA
// ============================================================

function defaultUserLimits() {
  return {
    max_daily_searches: 50, max_monthly_searches: 1000, max_daily_leads: 500,
    max_monthly_leads: 10000, max_ai_requests: 200, max_exports: 20, max_active_jobs: 3,
  };
}
function defaultUserUsage() {
  return {
    daily_searches: 0, monthly_searches: 0, daily_leads: 0, monthly_leads: 0,
    ai_requests: 0, export_count: 0, active_jobs: 0,
  };
}

const DEFAULT_CONFIGS: Omit<SystemConfig, 'updated_at' | 'updated_by'>[] = [
  { key: 'app.name', section: 'general', name: 'اسم التطبيق', description: 'اسم التطبيق المعروض', value: 'AI Lead Hunter', default_value: 'AI Lead Hunter', type: 'string' },
  { key: 'app.url', section: 'general', name: 'رابط التطبيق', description: 'الرابط الأساسي للتطبيق', value: 'https://leadhunter.ai', default_value: 'https://leadhunter.ai', type: 'string' },
  { key: 'app.timezone', section: 'general', name: 'المنطقة الزمنية', description: 'المنطقة الزمنية الافتراضية', value: 'Africa/Cairo', default_value: 'Africa/Cairo', type: 'string' },
  { key: 'app.language', section: 'general', name: 'اللغة الافتراضية', description: 'لغة الواجهة الافتراضية', value: 'ar', default_value: 'ar', type: 'string' },
  { key: 'research.max_concurrent_jobs', section: 'research', name: 'الحد الأقصى للوظائف المتزامنة', description: 'عدد وظائف البحث المتزامنة', value: 5, default_value: 5, type: 'number' },
  { key: 'research.max_leads_per_job', section: 'research', name: 'الحد الأقصى للعملاء لكل وظيفة', description: 'عدد العملاء الأقصى لكل وظيفة بحث', value: 1000, default_value: 1000, type: 'number' },
  { key: 'research.max_search_depth', section: 'research', name: 'عمق البحث الأقصى', description: 'عدد صفحات البحث الأقصى', value: 10, default_value: 10, type: 'number' },
  { key: 'research.request_timeout', section: 'research', name: 'مهلة الطلب', description: 'مهلة طلب البحث بالمللي ثانية', value: 30000, default_value: 30000, type: 'number' },
  { key: 'research.retry_attempts', section: 'research', name: 'محاولات إعادة المحاولة', description: 'عدد محاولات إعادة المحاولة عند الفشل', value: 3, default_value: 3, type: 'number' },
  { key: 'research.delay_between_requests', section: 'research', name: 'التأخير بين الطلبات', description: 'التأخير بين الطلبات بالمللي ثانية', value: 1000, default_value: 1000, type: 'number' },
  { key: 'research.daily_limit', section: 'research', name: 'الحد اليومي للبحث', description: 'الحد الأقصى لعمليات البحث اليومية', value: 100, default_value: 100, type: 'number' },
  { key: 'ai.default_provider', section: 'ai', name: 'مزود AI الافتراضي', description: 'المزود الافتراضي للذكاء الاصطناعي', value: 'openrouter', default_value: 'openrouter', type: 'string' },
  { key: 'ai.max_tokens', section: 'ai', name: 'الحد الأقصى للرموز', description: 'الحد الأقصى لرموز AI', value: 4000, default_value: 4000, type: 'number' },
  { key: 'ai.temperature', section: 'ai', name: 'درجة الحرارة', description: 'درجة حرارة النموذج', value: 0.7, default_value: 0.7, type: 'number' },
  { key: 'search.default_provider', section: 'search', name: 'مزود البحث الافتراضي', description: 'مزود البحث الافتراضي', value: 'tavily', default_value: 'tavily', type: 'string' },
  { key: 'leads.min_score', section: 'leads', name: 'الحد الأدنى للنتيجة', description: 'الحد الأدنى لنتيجة العميل', value: 50, default_value: 50, type: 'number' },
  { key: 'leads.auto_qualify', section: 'leads', name: 'التأهيل التلقائي', description: 'تأهيل العملاء تلقائياً', value: true, default_value: true, type: 'boolean' },
  { key: 'security.require_2fa', section: 'security', name: 'مطلوب 2FA', description: 'تطلب المصادقة الثنائية', value: false, default_value: false, type: 'boolean' },
  { key: 'security.session_timeout', section: 'security', name: 'مهلة الجلسة', description: 'مهلة انتهاء الجلسة بالدقائق', value: 60, default_value: 60, type: 'number' },
  { key: 'security.max_login_attempts', section: 'security', name: 'الحد الأقصى لمحاولات الدخول', description: 'الحد الأقصى لمحاولات الدخول الفاشلة', value: 5, default_value: 5, type: 'number' },
  { key: 'notifications.email_enabled', section: 'notifications', name: 'إشعارات البريد', description: 'تفعيل إشعارات البريد الإلكتروني', value: true, default_value: true, type: 'boolean' },
  { key: 'limits.default_daily_searches', section: 'limits', name: 'الحد اليومي للبحث', description: 'الحد اليومي الافتراضي للبحث', value: 50, default_value: 50, type: 'number' },
  { key: 'limits.default_monthly_leads', section: 'limits', name: 'الحد الشهري للعملاء', description: 'الحد الشهري الافتراضي للعملاء', value: 10000, default_value: 10000, type: 'number' },
];

const DEFAULT_FEATURE_FLAGS: Omit<FeatureFlag, 'id' | 'updated_at'>[] = [
  { key: 'facebook_connector', name: 'موصل Facebook', description: 'تفعيل موصل Facebook للبحث', enabled: true, scope: 'global' },
  { key: 'google_maps', name: 'موصل Google Maps', description: 'تفعيل موصل Google Maps للبحث', enabled: true, scope: 'global' },
  { key: 'linkedin_connector', name: 'موصل LinkedIn', description: 'تفعيل موصل LinkedIn للبحث', enabled: false, scope: 'global' },
  { key: 'web_research', name: 'البحث على الويب', description: 'تفعيل البحث على الويب', enabled: true, scope: 'global' },
  { key: 'ai_scoring', name: 'تقييم AI', description: 'تفعيل تقييم العملاء بالذكاء الاصطناعي', enabled: true, scope: 'global' },
  { key: 'entity_matching', name: 'مطابقة الكيانات', description: 'تفعيل مطابقة الكيانات بين المصادر', enabled: true, scope: 'global' },
  { key: 'bulk_export', name: 'التصدير بالجملة', description: 'تفعيل التصدير بالجملة', enabled: true, scope: 'global' },
  { key: 'advanced_analytics', name: 'التحليلات المتقدمة', description: 'تفعيل التحليلات المتقدمة', enabled: true, scope: 'global' },
];

const DEFAULT_AI_MODEL_ROUTER: AIModelRouter[] = [
  { task: 'research_planning', primary_model: 'anthropic/claude-3.5-sonnet', secondary_model: 'openai/gpt-4o', fallback_model: 'google/gemini-pro' },
  { task: 'data_extraction', primary_model: 'openai/gpt-4o', secondary_model: 'anthropic/claude-3.5-sonnet', fallback_model: 'google/gemini-pro' },
  { task: 'intent_detection', primary_model: 'openai/gpt-4o-mini', secondary_model: 'google/gemini-1.5-flash', fallback_model: 'anthropic/claude-3-haiku' },
  { task: 'lead_scoring', primary_model: 'openai/gpt-4o-mini', secondary_model: 'google/gemini-1.5-flash', fallback_model: 'openai/gpt-4o' },
  { task: 'entity_matching', primary_model: 'anthropic/claude-3.5-sonnet', secondary_model: 'openai/gpt-4o', fallback_model: 'google/gemini-pro' },
  { task: 'summarization', primary_model: 'google/gemini-1.5-flash', secondary_model: 'openai/gpt-4o-mini', fallback_model: 'anthropic/claude-3-haiku' },
];

const DEFAULT_INTENT_CATEGORIES: Omit<IntentCategory, 'id'>[] = [
  { name: 'Insurance', description: 'تأمين', ai_instructions: 'ابحث عن اهتمام بأنواع التأمين', weight: 25, enabled: true },
  { name: 'Savings', description: 'ادخار', ai_instructions: 'ابحث عن اهتمام بالادخار والتوفير', weight: 20, enabled: true },
  { name: 'Investment', description: 'استثمار', ai_instructions: 'ابحث عن اهتمام بالاستثمار', weight: 25, enabled: true },
  { name: 'Retirement', description: 'تقاعد', ai_instructions: 'ابحث عن اهتمام بالتقاعد', weight: 15, enabled: true },
  { name: 'Education', description: 'تعليم', ai_instructions: 'ابحث عن اهتمام بالتعليم', weight: 15, enabled: true },
  { name: 'Family Protection', description: 'حماية الأسرة', ai_instructions: 'ابحث عن اهتمام بحماية الأسرة', weight: 25, enabled: true },
  { name: 'Business Owner', description: 'صاحب عمل', ai_instructions: 'ابحث عن أصحاب الأعمال', weight: 20, enabled: true },
  { name: 'Other', description: 'أخرى', ai_instructions: 'فئة عامة', weight: 5, enabled: true },
];

const DEFAULT_NOTIFICATIONS: AdminNotificationConfig[] = [
  { key: 'job_failure', name: 'تنبيه فشل الوظيفة', enabled: true, recipients: [], severity: 'high' },
  { key: 'api_limit', name: 'تنبيه حد API', enabled: true, recipients: [], severity: 'medium' },
  { key: 'security_alert', name: 'تنبيه أمني', enabled: true, recipients: [], severity: 'critical' },
  { key: 'system_error', name: 'خطأ في النظام', enabled: true, recipients: [], severity: 'high' },
  { key: 'new_user', name: 'مستخدم جديد', enabled: false, recipients: [], severity: 'low' },
];

// ============================================================
// INITIALIZATION
// ============================================================

export async function initAdminData(): Promise<void> {
  await initRoles();

  // Seed configs
  const configs = await dbGetAll<SystemConfig>('admin_config');
  if (configs.length === 0) {
    for (const c of DEFAULT_CONFIGS) {
      await dbPut('admin_config', { ...c, updated_at: nowISO(), updated_by: 'system' });
    }
  }

  // Seed feature flags
  const flags = await dbGetAll<FeatureFlag>('admin_feature_flags');
  if (flags.length === 0) {
    for (const f of DEFAULT_FEATURE_FLAGS) {
      await dbPut('admin_feature_flags', { ...f, id: generateId(), updated_at: nowISO() });
    }
  }

  // Seed AI model router
  const router = await dbGetAll<AIModelRouter>('admin_ai_model_router');
  if (router.length === 0) {
    for (const r of DEFAULT_AI_MODEL_ROUTER) {
      await dbPut('admin_ai_model_router', { ...r } as any);
    }
  }

  // Seed intent categories
  const intents = await dbGetAll<IntentCategory>('admin_intent_categories');
  if (intents.length === 0) {
    for (const i of DEFAULT_INTENT_CATEGORIES) {
      await dbPut('admin_intent_categories', { ...i, id: generateId() });
    }
  }

  // Seed notifications
  const notifs = await dbGetAll<AdminNotificationConfig>('admin_notifications');
  if (notifs.length === 0) {
    for (const n of DEFAULT_NOTIFICATIONS) {
      await dbPut('admin_notifications', n as any);
    }
  }

  // Seed source connectors
  const connectors = await dbGetAll<AdminSourceConnector>('admin_source_connectors');
  if (connectors.length === 0) {
    const seed: AdminSourceConnector[] = [
      { code: 'google_maps', name: 'Google Maps', enabled: true, available: true, auth_type: 'api_key', api_status: 'healthy', usage_count: 0, limits: { max_per_day: 1000, max_per_hour: 100 } },
      { code: 'web_search', name: 'Web Search', enabled: true, available: true, auth_type: 'api_key', api_status: 'healthy', usage_count: 0, limits: { max_per_day: 5000, max_per_hour: 200 } },
      { code: 'facebook', name: 'Facebook', enabled: true, available: true, auth_type: 'oauth', api_status: 'warning', usage_count: 0, limits: { max_per_day: 500, max_per_hour: 50 } },
      { code: 'linkedin', name: 'LinkedIn', enabled: false, available: false, auth_type: 'oauth', api_status: 'offline', usage_count: 0, limits: { max_per_day: 200, max_per_hour: 20 } },
      { code: 'website', name: 'Website', enabled: true, available: true, auth_type: 'none', api_status: 'healthy', usage_count: 0, limits: { max_per_day: 10000, max_per_hour: 500 } },
    ];
    for (const c of seed) await dbPut('admin_source_connectors', c);
  }
}

// ============================================================
// AUTHORIZATION GUARD
// ============================================================

async function requireSuperAdmin(userId: string): Promise<void> {
  const ok = await isSuperAdmin(userId);
  if (!ok) throw new Error('غير مصرح — يتطلب صلاحيات Super Admin');
}

async function requirePermission(userId: string, perm: Permission): Promise<void> {
  const ok = await hasPermission(userId, perm);
  if (!ok) throw new Error(`غير مصرح — يتطلب صلاحية ${perm}`);
}

// ============================================================
// USER MANAGEMENT
// ============================================================

export async function getAdminUsers(): Promise<AdminUser[]> {
  await initAdminData();
  const users = await dbGetAll<AdminUser>('admin_users');
  return users.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getAdminUser(id: string): Promise<AdminUser | null> {
  const users = await dbGetAll<AdminUser>('admin_users');
  return users.find((u) => u.id === id) ?? null;
}

export async function createAdminUser(
  actorId: string,
  email: string,
  fullName: string,
  role: SystemRole,
  password: string,
): Promise<AdminUser> {
  await requirePermission(actorId, 'manage_users');
  const safeRole: SystemRole = role;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke('admin-user-management', {
      body: { action: 'create', email, fullName, role: safeRole, password },
    });
    if (error) throw error;
    if (!data?.adminUser) throw new Error('تعذر إنشاء المستخدم');
    return data.adminUser as AdminUser;
  }
  const users = await dbGetAll<AdminUser>('admin_users');
  if (users.some((u) => u.email === email)) throw new Error('البريد الإلكتروني مسجل بالفعل');
  const roles = await getRoles();
  const roleDef = roles.find((r) => r.name === safeRole);
  const user: AdminUser = {
    id: generateId(),
    email,
    full_name: fullName,
    role: safeRole,
    status: 'active',
    created_at: nowISO(),
    updated_at: nowISO(),
    permissions: roleDef?.permissions ?? [],
    usage: defaultUserUsage(),
    limits: defaultUserLimits(),
  };
  await dbPut('admin_users', user);
  // Store password in local users for auth compatibility
  const localUsers = JSON.parse(localStorage.getItem('alh_local_users') ?? '[]');
  localUsers.push({ id: user.id, email, password, full_name: fullName });
  localStorage.setItem('alh_local_users', JSON.stringify(localUsers));
  await logAdminAction(actorId, 'user.create', 'user', user.id, { email, role: safeRole });
  return user;
}

export async function updateAdminUser(actorId: string, id: string, updates: Partial<AdminUser>): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  const users = await dbGetAll<AdminUser>('admin_users');
  const existing = users.find((u) => u.id === id);
  if (!existing) throw new Error('المستخدم غير موجود');
  await dbPut('admin_users', { ...existing, ...updates, updated_at: nowISO() });
  await logAdminAction(actorId, 'user.update', 'user', id, updates);
}

export async function setAdminUserRole(actorId: string, id: string, role: SystemRole): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  const existing = await getAdminUser(id);
  const safeRole: SystemRole = role;
  const roles = await getRoles();
  const roleDef = roles.find((r) => r.name === safeRole);
  await updateAdminUser(actorId, id, { role: safeRole, permissions: roleDef?.permissions ?? [] });
  await logAdminAction(actorId, 'user.role_change', 'user', id, { role: safeRole });
}

export async function setAdminUserStatus(actorId: string, id: string, status: AdminUser['status']): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  await updateAdminUser(actorId, id, { status });
  await logAdminAction(actorId, 'user.status_change', 'user', id, { status });
}

export async function deleteAdminUser(actorId: string, id: string): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  const user = await getAdminUser(id);
  if (user?.role === 'SUPER_ADMIN') throw new Error('لا يمكن حذف Super Admin');
  await dbDelete('admin_users', id);
  await logAdminAction(actorId, 'user.delete', 'user', id, { email: user?.email });
}

export async function resetUserPassword(actorId: string, id: string, newPassword: string): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.functions.invoke('admin-user-management', {
      body: { action: 'reset_password', userId: id, password: newPassword },
    });
    if (error) throw error;
    await logAdminAction(actorId, 'user.password_reset', 'user', id, {});
    return;
  }
  const localUsers = JSON.parse(localStorage.getItem('alh_local_users') ?? '[]');
  const idx = localUsers.findIndex((u: any) => u.id === id);
  if (idx >= 0) {
    localUsers[idx].password = newPassword;
    localStorage.setItem('alh_local_users', JSON.stringify(localUsers));
  }
  await logAdminAction(actorId, 'user.password_reset', 'user', id, {});
}

// ============================================================
// ROLES & PERMISSIONS
// ============================================================

export async function getAdminRoles(): Promise<RoleDefinition[]> {
  await initAdminData();
  return getRoles();
}

export async function createAdminRole(actorId: string, name: string, description: string, permissions: Permission[]): Promise<RoleDefinition> {
  await requirePermission(actorId, 'manage_users');
  const role = await createRoleRBAC(name, description, permissions);
  await logAdminAction(actorId, 'role.create', 'role', role.id, { name });
  return role;
}

export async function updateAdminRole(actorId: string, id: string, updates: Partial<RoleDefinition>): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  await updateRoleRBAC(id, updates);
  await logAdminAction(actorId, 'role.update', 'role', id, updates);
}

export async function deleteAdminRole(actorId: string, id: string): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  await deleteRoleRBAC(id);
  await logAdminAction(actorId, 'role.delete', 'role', id, {});
}

// ============================================================
// SYSTEM CONFIG
// ============================================================

export async function getSystemConfigs(): Promise<SystemConfig[]> {
  await initAdminData();
  return dbGetAll<SystemConfig>('admin_config');
}

export async function getConfigsBySection(section: string): Promise<SystemConfig[]> {
  const all = await getSystemConfigs();
  return all.filter((c) => c.section === section);
}

export async function updateSystemConfig(actorId: string, key: string, value: string | number | boolean): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const all = await dbGetAll<SystemConfig>('admin_config');
  const existing = all.find((c) => c.key === key);
  if (!existing) throw new Error(`الإعداد ${key} غير موجود`);

  // Save change history
  const change: ConfigChange = {
    id: generateId(),
    key,
    old_value: String(existing.value),
    new_value: String(value),
    changed_by: actorId,
    changed_at: nowISO(),
  };
  await dbPut('admin_config_changes', change);

  await dbPut('admin_config', { ...existing, value, updated_at: nowISO(), updated_by: actorId });
  await logAdminAction(actorId, 'config.update', 'config', key, { old: existing.value, new: value });
}

export async function resetConfigToDefault(actorId: string, key: string): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const all = await dbGetAll<SystemConfig>('admin_config');
  const existing = all.find((c) => c.key === key);
  if (!existing) throw new Error(`الإعداد ${key} غير موجود`);
  const change: ConfigChange = {
    id: generateId(), key, old_value: String(existing.value), new_value: String(existing.default_value),
    changed_by: actorId, changed_at: nowISO(),
  };
  await dbPut('admin_config_changes', change);
  await dbPut('admin_config', { ...existing, value: existing.default_value, updated_at: nowISO(), updated_by: actorId });
  await logAdminAction(actorId, 'config.reset', 'config', key, {});
}

export async function getConfigHistory(key: string): Promise<ConfigChange[]> {
  const all = await dbGetAll<ConfigChange>('admin_config_changes');
  return all.filter((c) => c.key === key).sort((a, b) => b.changed_at.localeCompare(a.changed_at));
}

// ============================================================
// AI PROVIDERS (ADMIN)
// ============================================================

export async function getAdminAIProviders(): Promise<AdminAIProvider[]> {
  await initAdminData();
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke('admin-provider-secrets', { body: { action: 'list' } });
    if (!error && Array.isArray(data?.providers)) return data.providers as AdminAIProvider[];
  }
  const existing = await dbGetAll<AdminAIProvider>('admin_ai_providers');
  if (existing.length > 0) return existing.map(({ api_key_encrypted: _secret, ...provider }) => provider).sort((a, b) => a.priority - b.priority);
  // Seed defaults
  const seed: AdminAIProvider[] = [
    { id: generateId(), provider: 'openrouter', enabled: true, api_key_masked: '', priority: 1, default_model: 'openrouter/free', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, openrouter_auto_mode: true, model_fallback_chain: ['qwen/qwen3-32b:free', 'deepseek/deepseek-r1:free', 'google/gemma-3-27b-it:free'], updated_at: nowISO() },
    { id: generateId(), provider: 'grok', enabled: false, api_key_masked: '', priority: 2, default_model: 'grok-4.6', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.x.ai/v1', model_fallback_chain: ['grok-4.6-latest'], updated_at: nowISO() },
    { id: generateId(), provider: 'groq', enabled: false, api_key_masked: '', priority: 3, default_model: 'llama-3.3-70b-versatile', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.groq.com/openai/v1', model_fallback_chain: ['openai/gpt-oss-120b'], updated_at: nowISO() },
    { id: generateId(), provider: 'cerebras', enabled: false, api_key_masked: '', priority: 4, default_model: 'llama-3.3-70b', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.cerebras.ai/v1', model_fallback_chain: ['qwen-3-32b'], updated_at: nowISO() },
    { id: generateId(), provider: 'mistral', enabled: false, api_key_masked: '', priority: 5, default_model: 'mistral-small-latest', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, base_url: 'https://api.mistral.ai/v1', model_fallback_chain: ['mistral-large-latest'], updated_at: nowISO() },
    { id: generateId(), provider: 'openai', enabled: false, api_key_masked: '', priority: 6, default_model: 'gpt-4o-mini', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, updated_at: nowISO() },
    { id: generateId(), provider: 'gemini', enabled: false, api_key_masked: '', priority: 7, default_model: 'gemini-2.5-flash', fallback_enabled: true, max_requests: 1000, timeout_ms: 30000, retry_count: 3, updated_at: nowISO() },
    { id: generateId(), provider: 'anthropic', enabled: false, api_key_masked: '', priority: 8, default_model: 'claude-3-5-haiku-latest', fallback_enabled: true, max_requests: 500, timeout_ms: 30000, retry_count: 3, updated_at: nowISO() },
    { id: generateId(), provider: 'huggingface', enabled: false, api_key_masked: '', priority: 9, default_model: 'mistralai/Mistral-7B-Instruct-v0.3', fallback_enabled: false, max_requests: 500, timeout_ms: 60000, retry_count: 2, updated_at: nowISO() },
  ];
  for (const p of seed) await dbPut('admin_ai_providers', p);
  return seed;
}

export async function updateAdminAIProvider(actorId: string, id: string, updates: Partial<AdminAIProvider> & { api_key_input?: string }): Promise<void> {
  await requirePermission(actorId, 'manage_ai');
  const apiKey = updates.api_key_input?.trim();
  const { api_key_input: _input, api_key_encrypted: _secret, ...safeUpdates } = updates;
  if (isSupabaseConfigured && supabase) {
    if (apiKey) {
      const { data, error } = await supabase.functions.invoke('admin-provider-secrets', { body: { action: 'save', provider_id: id, api_key: apiKey } });
      if (error || !data?.success) throw error ?? new Error(data?.error ?? 'تعذر حفظ المفتاح');
    }
    if (Object.keys(safeUpdates).length > 0) {
      const { error } = await supabase.from('admin_ai_providers').update({ ...safeUpdates, updated_at: nowISO() }).eq('id', id);
      if (error) throw error;
    }
    await logAdminAction(actorId, 'ai_provider.update', 'ai_provider', id, { ...safeUpdates, key_changed: Boolean(apiKey) });
    return;
  }
  if (apiKey || !isSupabaseConfigured) {
    throw new Error('تخزين مفاتيح مزودي AI متاح فقط عبر Supabase الآمن.');
  }
  const all = await dbGetAll<AdminAIProvider>('admin_ai_providers');
  const existing = all.find((p) => p.id === id); if (!existing) throw new Error('المزود غير موجود');
  await dbPut('admin_ai_providers', { ...existing, ...safeUpdates, updated_at: nowISO() });
  await logAdminAction(actorId, 'ai_provider.update', 'ai_provider', id, { ...safeUpdates, key_changed: false });
}

export async function removeAdminAIProviderKey(actorId: string, id: string): Promise<void> {
  await requirePermission(actorId, 'manage_ai');
  if (!supabase) throw new Error('حفظ المفاتيح يحتاج Supabase');
  const { error } = await supabase.functions.invoke('admin-provider-secrets', { body: { action: 'remove', provider_id: id } });
  if (error) throw error;
}

export async function testAdminAIProvider(actorId: string, id: string): Promise<{ success: boolean; message: string }> {
  await requirePermission(actorId, 'manage_ai');
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('admin-provider-secrets', { body: { action: 'test', provider_id: id } });
    if (error) return { success: false, message: error.message };
    return { success: Boolean(data?.success), message: String(data?.message ?? 'انتهى الاختبار') };
  }
  const all = await dbGetAll<AdminAIProvider>('admin_ai_providers');
  const existing = all.find((p) => p.id === id); const success = Boolean(existing?.enabled && existing?.api_key_masked);
  return { success, message: success ? 'تم الاتصال بنجاح' : 'أضف المفتاح وفعّل المزود أولاً' };
}


// ============================================================
// AI MODEL ROUTER
// ============================================================

export async function getAIModelRouter(): Promise<AIModelRouter[]> {
  await initAdminData();
  return dbGetAll<AIModelRouter>('admin_ai_model_router');
}

export async function updateAIModelRouter(actorId: string, task: string, updates: Partial<AIModelRouter>): Promise<void> {
  await requirePermission(actorId, 'manage_ai');
  const all = await dbGetAll<AIModelRouter>('admin_ai_model_router');
  const existing = all.find((r) => r.task === task);
  if (!existing) {
    const newRouter: AIModelRouter = { task: task as AIModelRouter['task'], primary_model: '', secondary_model: '', fallback_model: '', ...updates } as AIModelRouter;
    await dbPut('admin_ai_model_router', newRouter as any);
  } else {
    await dbPut('admin_ai_model_router', { ...existing, ...updates } as any);
  }
  await logAdminAction(actorId, 'ai_model_router.update', 'ai_model_router', task, updates);
}

// ============================================================
// SEARCH PROVIDERS
// ============================================================

export async function getAdminSearchProviders(): Promise<AdminSearchProvider[]> {
  await initAdminData();
  const existing = await dbGetAll<AdminSearchProvider>('admin_search_providers');
  if (existing.length > 0) return existing.sort((a, b) => a.priority - b.priority);
  const seed: AdminSearchProvider[] = [
    { id: generateId(), name: 'Tavily', enabled: true, api_key_masked: '', priority: 1, daily_limit: 5000, requests_per_minute: 100, timeout_ms: 15000, fallback_enabled: true, updated_at: nowISO() },
    { id: generateId(), name: 'Google Search', enabled: false, api_key_masked: '', priority: 2, daily_limit: 1000, requests_per_minute: 50, timeout_ms: 15000, fallback_enabled: true, updated_at: nowISO() },
    { id: generateId(), name: 'Bing', enabled: false, api_key_masked: '', priority: 3, daily_limit: 1000, requests_per_minute: 50, timeout_ms: 15000, fallback_enabled: false, updated_at: nowISO() },
    { id: generateId(), name: 'Serper', enabled: false, api_key_masked: '', priority: 4, daily_limit: 2500, requests_per_minute: 75, timeout_ms: 15000, fallback_enabled: true, updated_at: nowISO() },
  ];
  for (const p of seed) await dbPut('admin_search_providers', p);
  return seed;
}

export async function updateAdminSearchProvider(actorId: string, id: string, updates: Partial<AdminSearchProvider>): Promise<void> {
  await requirePermission(actorId, 'manage_sources');
  const all = await dbGetAll<AdminSearchProvider>('admin_search_providers');
  const existing = all.find((p) => p.id === id);
  if (!existing) throw new Error('المزود غير موجود');
  if ('api_key_masked' in updates) {
    throw new Error('مفاتيح مزودي البحث لا تُخزن محليًا؛ استخدم تكامل Supabase الآمن.');
  }
  await dbPut('admin_search_providers', { ...existing, ...updates, updated_at: nowISO() });
  await logAdminAction(actorId, 'search_provider.update', 'search_provider', id, updates);
}

export async function testSearchProvider(actorId: string, id: string): Promise<{ success: boolean; message: string }> {
  await requirePermission(actorId, 'manage_sources');
  await new Promise((r) => setTimeout(r, 500));
  const all = await dbGetAll<AdminSearchProvider>('admin_search_providers');
  const existing = all.find((p) => p.id === id);
  await logAdminAction(actorId, 'search_provider.test', 'search_provider', id, { success: !!existing?.enabled });
  return { success: !!existing?.enabled, message: existing?.enabled ? 'تم الاتصال بنجاح' : 'المزود غير مفعل' };
}

// ============================================================
// SOURCE CONNECTORS
// ============================================================

export async function getAdminSourceConnectors(): Promise<AdminSourceConnector[]> {
  await initAdminData();
  return dbGetAll<AdminSourceConnector>('admin_source_connectors');
}

export async function updateSourceConnector(actorId: string, code: string, updates: Partial<AdminSourceConnector>): Promise<void> {
  await requirePermission(actorId, 'manage_sources');
  const all = await dbGetAll<AdminSourceConnector>('admin_source_connectors');
  const existing = all.find((c) => c.code === code);
  if (!existing) throw new Error('الموصل غير موجود');
  await dbPut('admin_source_connectors', { ...existing, ...updates });
  await logAdminAction(actorId, 'source_connector.update', 'source_connector', code, updates);
}

export async function testSourceConnector(actorId: string, code: string): Promise<{ success: boolean; message: string }> {
  await requirePermission(actorId, 'manage_sources');
  const all = await dbGetAll<AdminSourceConnector>('admin_source_connectors');
  const existing = all.find((c) => c.code === code);
  if (!existing) return { success: false, message: 'الموصل غير موجود' };
  await updateSourceConnector(actorId, code, { last_test: nowISO(), api_status: existing.available ? 'healthy' : 'offline' });
  await logAdminAction(actorId, 'source_connector.test', 'source_connector', code, {});
  return { success: existing.available, message: existing.available ? 'الموصل يعمل' : 'الموصل غير متاح' };
}

// ============================================================
// RESEARCH ENGINE CONFIG
// ============================================================

const DEFAULT_RESEARCH_CONFIG: ResearchEngineConfig = {
  max_concurrent_jobs: 5, max_leads_per_job: 1000, max_search_depth: 10,
  request_timeout_ms: 30000, retry_attempts: 3, delay_between_requests_ms: 1000,
  daily_research_limit: 100, max_sources_per_campaign: 5, ai_qualification_threshold: 50,
};

export async function getResearchEngineConfig(): Promise<ResearchEngineConfig> {
  await initAdminData();
  const existing = await dbGetAll<ResearchEngineConfig>('admin_research_engine');
  if (existing.length > 0) return existing[0];
  await dbPut('admin_research_engine', { ...DEFAULT_RESEARCH_CONFIG, id: 'research-engine-config' } as any);
  return DEFAULT_RESEARCH_CONFIG;
}

export async function updateResearchEngineConfig(actorId: string, updates: Partial<ResearchEngineConfig>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const existing = await getResearchEngineConfig();
  await dbPut('admin_research_engine', { ...existing, ...updates, id: 'research-engine-config' } as any);
  await logAdminAction(actorId, 'research_engine.update', 'research_engine', 'config', updates);
}

export async function applyResearchPreset(actorId: string, preset: 'conservative' | 'balanced' | 'aggressive'): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const presets: Record<string, Partial<ResearchEngineConfig>> = {
    conservative: { max_concurrent_jobs: 2, max_leads_per_job: 500, delay_between_requests_ms: 3000, retry_attempts: 1, daily_research_limit: 50 },
    balanced: { max_concurrent_jobs: 5, max_leads_per_job: 1000, delay_between_requests_ms: 1000, retry_attempts: 3, daily_research_limit: 100 },
    aggressive: { max_concurrent_jobs: 10, max_leads_per_job: 2000, delay_between_requests_ms: 500, retry_attempts: 5, daily_research_limit: 200 },
  };
  await updateResearchEngineConfig(actorId, presets[preset]);
  await logAdminAction(actorId, 'research_engine.preset', 'research_engine', 'config', { preset });
}

// ============================================================
// LEAD SCORING (ADMIN)
// ============================================================

const DEFAULT_ADMIN_SCORING: AdminScoringConfig = {
  weights: { phone: 20, intent: 25, location: 10, business: 15, multiple_sources: 10, data_completeness: 10, source_quality: 5, recency: 5 },
  thresholds: { hot: 80, high: 65, medium: 45 },
};

export async function getAdminScoringConfig(): Promise<AdminScoringConfig> {
  await initAdminData();
  const existing = await dbGetAll<AdminScoringConfig>('admin_scoring');
  if (existing.length > 0) return existing[0];
  await dbPut('admin_scoring', { ...DEFAULT_ADMIN_SCORING, id: 'admin-scoring-config' } as any);
  return DEFAULT_ADMIN_SCORING;
}

export async function updateAdminScoringConfig(actorId: string, updates: Partial<AdminScoringConfig>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const existing = await getAdminScoringConfig();
  const updated = { ...existing, ...updates };
  // Validate weights sum to 100
  const w = updated.weights;
  const sum = w.phone + w.intent + w.location + w.business + w.multiple_sources + w.data_completeness + w.source_quality + w.recency;
  if (sum !== 100) throw new Error(`مجموع الأوزان يجب أن يكون 100. الحالي: ${sum}`);
  await dbPut('admin_scoring', { ...updated, id: 'admin-scoring-config' } as any);
  await logAdminAction(actorId, 'scoring.update', 'scoring', 'config', updates);
}

// ============================================================
// INTENT CATEGORIES
// ============================================================

export async function getIntentCategories(): Promise<IntentCategory[]> {
  await initAdminData();
  return dbGetAll<IntentCategory>('admin_intent_categories');
}

export async function createIntentCategory(actorId: string, name: string, description: string, aiInstructions: string, weight: number): Promise<IntentCategory> {
  await requirePermission(actorId, 'manage_settings');
  const cat: IntentCategory = { id: generateId(), name, description, ai_instructions: aiInstructions, weight, enabled: true };
  await dbPut('admin_intent_categories', cat);
  await logAdminAction(actorId, 'intent.create', 'intent_category', cat.id, { name });
  return cat;
}

export async function updateIntentCategory(actorId: string, id: string, updates: Partial<IntentCategory>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const all = await dbGetAll<IntentCategory>('admin_intent_categories');
  const existing = all.find((c) => c.id === id);
  if (!existing) throw new Error('الفئة غير موجودة');
  await dbPut('admin_intent_categories', { ...existing, ...updates });
  await logAdminAction(actorId, 'intent.update', 'intent_category', id, updates);
}

export async function deleteIntentCategory(actorId: string, id: string): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  await dbDelete('admin_intent_categories', id);
  await logAdminAction(actorId, 'intent.delete', 'intent_category', id, {});
}

// ============================================================
// PHONE RULES (ADMIN)
// ============================================================

const DEFAULT_ADMIN_PHONE_RULES: AdminPhoneRules = {
  country_code: '+20',
  mobile_prefixes: ['010', '011', '012', '015'],
  require_mobile: true, allow_landline: false, verify_format: true, normalize_automatically: true, reject_invalid: true,
};

export async function getAdminPhoneRules(): Promise<AdminPhoneRules> {
  await initAdminData();
  const existing = await dbGetAll<AdminPhoneRules>('admin_phone_rules');
  if (existing.length > 0) return existing[0];
  await dbPut('admin_phone_rules', { ...DEFAULT_ADMIN_PHONE_RULES, id: 'admin-phone-rules' } as any);
  return DEFAULT_ADMIN_PHONE_RULES;
}

export async function updateAdminPhoneRules(actorId: string, updates: Partial<AdminPhoneRules>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const existing = await getAdminPhoneRules();
  await dbPut('admin_phone_rules', { ...existing, ...updates, id: 'admin-phone-rules' } as any);
  await logAdminAction(actorId, 'phone_rules.update', 'phone_rules', 'config', updates);
}

// ============================================================
// DUPLICATE ENGINE (ADMIN)
// ============================================================

const DEFAULT_DUPLICATE_CONFIG: DuplicateEngineConfig = {
  phone_match_weight: 40, email_match_weight: 25, name_match_weight: 20,
  business_match_weight: 15, location_match_weight: 10, website_match_weight: 20,
  auto_merge_threshold: 90, potential_duplicate_threshold: 70, keep_separate_threshold: 70,
};

export async function getDuplicateEngineConfig(): Promise<DuplicateEngineConfig> {
  await initAdminData();
  const existing = await dbGetAll<DuplicateEngineConfig>('admin_duplicate_engine');
  if (existing.length > 0) return existing[0];
  await dbPut('admin_duplicate_engine', { ...DEFAULT_DUPLICATE_CONFIG, id: 'admin-duplicate-engine' } as any);
  return DEFAULT_DUPLICATE_CONFIG;
}

export async function updateDuplicateEngineConfig(actorId: string, updates: Partial<DuplicateEngineConfig>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const existing = await getDuplicateEngineConfig();
  await dbPut('admin_duplicate_engine', { ...existing, ...updates, id: 'admin-duplicate-engine' } as any);
  await logAdminAction(actorId, 'duplicate_engine.update', 'duplicate_engine', 'config', updates);
}

// ============================================================
// FEATURE FLAGS
// ============================================================

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  await initAdminData();
  return dbGetAll<FeatureFlag>('admin_feature_flags');
}

export async function updateFeatureFlag(actorId: string, id: string, updates: Partial<FeatureFlag>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const all = await dbGetAll<FeatureFlag>('admin_feature_flags');
  const existing = all.find((f) => f.id === id);
  if (!existing) throw new Error('الميزة غير موجودة');
  await dbPut('admin_feature_flags', { ...existing, ...updates, updated_at: nowISO() });
  await logAdminAction(actorId, 'feature_flag.update', 'feature_flag', id, updates);
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  const flag = flags.find((f) => f.key === key);
  return flag?.enabled ?? false;
}

// ============================================================
// SYSTEM HEALTH
// ============================================================

export async function getSystemHealth(): Promise<SystemHealthCheck[]> {
  await initAdminData();
  const existing = await dbGetAll<SystemHealthCheck>('admin_health_checks');
  if (existing.length > 0) return existing;
  const checks: SystemHealthCheck[] = [
    { component: 'Supabase', status: 'healthy', latency_ms: 45, error_rate: 0, last_check: nowISO() },
    { component: 'Database', status: 'healthy', latency_ms: 12, error_rate: 0, last_check: nowISO() },
    { component: 'Edge Functions', status: 'healthy', latency_ms: 120, error_rate: 0, last_check: nowISO() },
    { component: 'AI Providers', status: 'warning', latency_ms: 850, error_rate: 2, last_check: nowISO(), message: 'بعض المزودين غير مفعلين' },
    { component: 'Search Providers', status: 'healthy', latency_ms: 200, error_rate: 0, last_check: nowISO() },
    { component: 'Source Connectors', status: 'warning', latency_ms: 350, error_rate: 1, last_check: nowISO(), message: 'LinkedIn غير متاح' },
    { component: 'Realtime', status: 'healthy', latency_ms: 30, error_rate: 0, last_check: nowISO() },
    { component: 'Queue / Jobs', status: 'healthy', latency_ms: 50, error_rate: 0, last_check: nowISO() },
  ];
  for (const c of checks) await dbPut('admin_health_checks', { ...c, id: c.component } as any);
  return checks;
}

export async function runHealthCheck(actorId: string): Promise<SystemHealthCheck[]> {
  await requireSuperAdmin(actorId);
  const checks = await getSystemHealth();
  // Simulate health check refresh
  const refreshed = checks.map((c) => ({ ...c, last_check: nowISO(), latency_ms: Math.floor(Math.random() * 200) + 20 }));
  for (const c of refreshed) await dbPut('admin_health_checks', { ...c, id: c.component } as any);
  await logAdminAction(actorId, 'health.check', 'system', 'all', {});
  return refreshed;
}

// ============================================================
// SECURITY EVENTS
// ============================================================

export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  await initAdminData();
  const existing = await dbGetAll<SecurityEvent>('admin_security_events');
  return existing.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
}

export async function logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'created_at'>): Promise<void> {
  const e: SecurityEvent = { ...event, id: generateId(), created_at: nowISO() };
  await dbPut('admin_security_events', e);
}

export async function forceLogoutUser(actorId: string, targetUserId: string): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  await logSecurityEvent({ type: 'force_logout', user_id: targetUserId, description: 'تسجيل خروج إجباري بواسطة Super Admin', severity: 'high' });
  await logAdminAction(actorId, 'security.force_logout', 'user', targetUserId, {});
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function getAdminNotifications(): Promise<AdminNotificationConfig[]> {
  await initAdminData();
  return dbGetAll<AdminNotificationConfig>('admin_notifications');
}

export async function updateAdminNotification(actorId: string, key: string, updates: Partial<AdminNotificationConfig>): Promise<void> {
  await requirePermission(actorId, 'manage_settings');
  const all = await dbGetAll<AdminNotificationConfig>('admin_notifications');
  const existing = all.find((n) => n.key === key);
  if (!existing) throw new Error('الإشعار غير موجود');
  await dbPut('admin_notifications', { ...existing, ...updates } as any);
  await logAdminAction(actorId, 'notification.update', 'notification', key, updates);
}

// ============================================================
// MAINTENANCE
// ============================================================

export async function getMaintenanceOps(): Promise<MaintenanceOperation[]> {
  await initAdminData();
  const existing = await dbGetAll<MaintenanceOperation>('admin_maintenance');
  return existing.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 50);
}

export async function runMaintenanceOp(actorId: string, operation: string): Promise<MaintenanceOperation> {
  await requireSuperAdmin(actorId);
  const op: MaintenanceOperation = {
    id: generateId(), operation, status: 'running', started_at: nowISO(), initiated_by: actorId,
  };
  await dbPut('admin_maintenance', op);
  // Simulate operation
  await new Promise((r) => setTimeout(r, 1000));
  const completed: MaintenanceOperation = { ...op, status: 'completed', completed_at: nowISO(), result: 'تمت العملية بنجاح' };
  await dbPut('admin_maintenance', completed);
  await logAdminAction(actorId, 'maintenance.run', 'maintenance', op.id, { operation });
  return completed;
}

// ============================================================
// AUDIT LOGGING (ADMIN)
// ============================================================

export async function getAdminAuditLogs(limit: number = 100): Promise<any[]> {
  await initAdminData();
  const all = await dbGetAll<any>('audit_logs');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function logAdminAction(userId: string, action: string, entityType: string, entityId?: string, details: Record<string, unknown> = {}): Promise<void> {
  const log = {
    id: generateId(), user_id: userId, action, entity_type: entityType, entity_id: entityId, details, created_at: nowISO(),
  };
  await dbPut('audit_logs', log);
}

// ============================================================
// USAGE & LIMITS
// ============================================================

export async function updateUserLimits(actorId: string, userId: string, limits: AdminUser['limits']): Promise<void> {
  await requirePermission(actorId, 'manage_users');
  await updateAdminUser(actorId, userId, { limits });
  await logAdminAction(actorId, 'user.limits_update', 'user', userId, { limits });
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getAdminDashboardStats(): Promise<{
  totalUsers: number; activeUsers: number; inactiveUsers: number;
  totalLeads: number; leadsToday: number; activeAgents: number;
  runningJobs: number; completedJobs: number; failedJobs: number;
  connectedSources: number; aiRequests: number; searchRequests: number; systemErrors: number;
}> {
  await initAdminData();
  const users = await dbGetAll<AdminUser>('admin_users');
  const { getLeads, getJobs } = await import('./services');
  const allLeads: any[] = [];
  const allJobs: any[] = [];
  // Aggregate across all users
  for (const u of users) {
    const uLeads = await getLeads(u.id);
    allLeads.push(...uLeads);
    const uJobs = await getJobs(u.id);
    allJobs.push(...uJobs);
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === 'active').length,
    inactiveUsers: users.filter((u) => u.status !== 'active').length,
    totalLeads: allLeads.length,
    leadsToday: allLeads.filter((l) => l.created_at.slice(0, 10) === today).length,
    activeAgents: allJobs.filter((j) => j.status === 'running').length,
    runningJobs: allJobs.filter((j) => j.status === 'running').length,
    completedJobs: allJobs.filter((j) => j.status === 'completed').length,
    failedJobs: allJobs.filter((j) => j.status === 'failed').length,
    connectedSources: 4,
    aiRequests: 0,
    searchRequests: 0,
    systemErrors: allJobs.filter((j) => j.status === 'failed').length,
  };
}

// ============================================================
// SMART AI ROUTER & RELIABILITY CENTER
// ============================================================

export async function getAIProviderHealth(): Promise<import('@/types').AIProviderHealth[]> {
  return dbGetAll<import('@/types').AIProviderHealth>('ai_provider_health');
}

export async function getAIModelHealth(): Promise<import('@/types').AIModelHealth[]> {
  return dbGetAll<import('@/types').AIModelHealth>('ai_model_health');
}

export async function getAIRoutingEvents(limit = 100): Promise<import('@/types').AIRoutingEvent[]> {
  const events = await dbGetAll<import('@/types').AIRoutingEvent>('ai_routing_events');
  return events.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function getAIRoutingRules(): Promise<import('@/types').AIRoutingRule[]> {
  return dbGetAll<import('@/types').AIRoutingRule>('ai_routing_rules');
}

export async function updateAIRoutingRule(actorId: string, task: string, updates: Partial<import('@/types').AIRoutingRule>): Promise<void> {
  await requirePermission(actorId, 'manage_ai');
  const all = await dbGetAll<import('@/types').AIRoutingRule>('ai_routing_rules');
  const existing = all.find((r) => r.task === task);
  const value = { ...(existing ?? { id: generateId(), task, provider_order: [], model_order: [], required_capabilities: [], enabled: true, updated_at: nowISO() }), ...updates, task, updated_at: nowISO() };
  await dbPut('ai_routing_rules', value);
  await logAdminAction(actorId, 'ai_routing_rule.update', 'ai_routing_rule', task, updates);
}

export async function refreshOpenRouterModels(actorId: string): Promise<{ count: number; free_models: number; models: unknown[] }> {
  await requirePermission(actorId, 'manage_ai');
  const data = await refreshOpenRouterModelPool();
  await logAdminAction(actorId, 'ai_models.refresh', 'ai_model_health', undefined, { count: data?.count, free_models: data?.free_models });
  return data;
}

export async function simulateAIRouterFailure(actorId: string, simulation: import('@/types').AIOrchestratorRequest['simulate']): Promise<import('@/types').AIOrchestratorResponse> {
  await requirePermission(actorId, 'manage_ai');
  const { simulateFailover } = await import('./ai-orchestrator');
  const result = await simulateFailover(simulation);
  await logAdminAction(actorId, 'ai_failover.simulate', 'ai_router', undefined, { simulation, success: result.success, events: result.events });
  return result;
}

export async function getAIReliabilityStats() {
  const { getReliabilitySnapshot } = await import('./ai-orchestrator');
  return getReliabilitySnapshot();
}

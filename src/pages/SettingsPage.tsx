// ============================================================
// Settings — AI Providers, Source Connections, Scoring, Phone Rules, Duplicate Rules, Profile
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getSources, getSourceConnections, createSourceConnection, startOAuthConnection, deleteSourceConnection,
  testSourceConnection, getAIProviders, createAIProvider, deleteAIProvider, updateAIProvider,
  getSettings, updateSettings, getProfile, updateProfile,
} from '@/lib/services';
import type { Source, SourceConnection, AIProvider, SystemSettings, Profile, AIProviderCode } from '@/types';
import { Card, Button, Input, Select, Toggle, Modal, Skeleton, Badge } from '@/components/ui';
import {
  Settings, Cpu, Plug, Star, Phone, Copy, User, Plus, Trash2, CheckCircle2, ShieldCheck,
  XCircle, Loader2, Key, AlertCircle, Save,
} from 'lucide-react';

type Tab = 'profile' | 'ai_providers' | 'source_connections' | 'scoring' | 'phone_rules' | 'duplicate_rules';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'profile', label: 'الملف الشخصي', icon: User },
  { key: 'ai_providers', label: 'مزودي AI', icon: Cpu },
  { key: 'source_connections', label: 'اتصالات المصادر', icon: Plug },
  { key: 'scoring', label: 'التقييم', icon: Star },
  { key: 'phone_rules', label: 'قواعد الهاتف', icon: Phone },
  { key: 'duplicate_rules', label: 'قواعد التكرار', icon: Copy },
];

const AI_PROVIDER_OPTIONS: { code: AIProviderCode; name: string; models: string[] }[] = [
  { code: 'openrouter', name: 'OpenRouter — Free Router تلقائي', models: ['openrouter/free'] },
  { code: 'grok', name: 'Grok (xAI)', models: ['grok-4.6', 'grok-4.6-latest'] },
  { code: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'] },
  { code: 'cerebras', name: 'Cerebras', models: ['llama-3.3-70b', 'qwen-3-32b'] },
  { code: 'mistral', name: 'Mistral AI', models: ['mistral-small-latest', 'mistral-large-latest'] },
  { code: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'] },
  { code: 'anthropic', name: 'Anthropic', models: ['claude-3-5-haiku-latest'] },
];

export function SettingsPage({ onEnterAdmin }: { onEnterAdmin?: () => void } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');

  // Sources
  const [sources, setSources] = useState<Source[]>([]);
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [showConnModal, setShowConnModal] = useState(false);
  const [connSource, setConnSource] = useState<string>('');
  const [connName, setConnName] = useState('');
  const [connCreds, setConnCreds] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [oauthConnecting, setOAuthConnecting] = useState<'linkedin' | 'facebook' | null>(null);

  // AI Providers
  const [aiProviders, setAIProviders] = useState<AIProvider[]>([]);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProvider, setAIProvider] = useState<AIProviderCode>('openrouter');
  const [aiModel, setAIModel] = useState('');
  const [aiKey, setAIKey] = useState('');
  const [aiPriority, setAIPriority] = useState(0);

  // Settings
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, c, p, ap, st, pr] = await Promise.all([
        getSources(), getSourceConnections(user.id), getProfile(user.id),
        getAIProviders(user.id), getSettings(user.id),
        getProfile(user.id),
      ]);
      setSources(s); setConnections(c); setAIProviders(ap); setSettings(st);
      setProfile(p); setFullName(p?.full_name ?? ''); setCompany(p?.company ?? ''); setRole(p?.role ?? '');
      if (pr) { setProfile(pr); setFullName(pr.full_name ?? ''); setCompany(pr.company ?? ''); setRole(pr.role ?? ''); }
    })();
  }, [user]);

  const reloadConnections = async () => {
    if (!user) return;
    setConnections(await getSourceConnections(user.id));
  };
  const reloadAIProviders = async () => {
    if (!user) return;
    setAIProviders(await getAIProviders(user.id));
  };

  // ---- Handlers ----
  const handleSaveProfile = async () => {
    if (!user) return;
    await updateProfile(user.id, { full_name: fullName, company, role });
    toast('تم حفظ الملف الشخصي', 'success');
  };

  const handleCreateConnection = async () => {
    if (!user || !connSource || !connName) return;
    const selectedSource = sources.find((s) => s.id === connSource);
    if (selectedSource?.code === 'web_search') {
      toast('Web Search يُدار مركزيًا من Super Admin؛ لا تحتاج لإضافة اتصال مستخدم.', 'success');
      setShowConnModal(false); setConnSource(''); setConnName(''); setConnCreds({});
      return;
    }
    try {
      await createSourceConnection(user.id, connSource, connName, connCreds);
      toast('تم إضافة الاتصال', 'success');
      setShowConnModal(false); setConnSource(''); setConnName(''); setConnCreds({});
      reloadConnections();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر إضافة الاتصال', 'error');
    }
  };

  const handleOAuthConnect = async (provider: 'linkedin' | 'facebook') => {
    setOAuthConnecting(provider);
    let timeoutId: number | undefined;
    try {
      const result = await new Promise<Awaited<ReturnType<typeof startOAuthConnection>>>((resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`استغرق الاتصال بـ ${provider === 'facebook' ? 'Facebook' : 'LinkedIn'} وقتًا أطول من المتوقع. تحقق من اتصال الإنترنت ثم أعد المحاولة.`)), 20000);
        startOAuthConnection(provider).then(resolve, reject);
      });
      const authorizationUrl = new URL(result.authorization_url);
      const trustedHost = provider === 'facebook' ? 'facebook.com' : 'linkedin.com';
      const isTrustedHost = authorizationUrl.protocol === 'https:'
        && (authorizationUrl.hostname === trustedHost || authorizationUrl.hostname.endsWith(`.${trustedHost}`));
      if (!isTrustedHost) throw new Error('رابط OAuth غير موثوق؛ تم إيقاف التحويل حفاظًا على أمان الحساب.');

      // Close the modal before navigation so mobile browsers do not keep a stale overlay.
      setShowConnModal(false);
      // Replace the current page directly; this works in mobile Chrome and installed PWA contexts.
      window.location.replace(authorizationUrl.toString());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر بدء ربط الحساب', 'error');
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setOAuthConnecting(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    if (!user) return;
    setTesting(id);
    const result = await testSourceConnection(user.id, id);
    setTesting(null);
    toast(result.message, result.success ? 'success' : 'error');
    reloadConnections();
  };

  const handleDeleteConnection = async (id: string) => {
    if (!user) return;
    await deleteSourceConnection(user.id, id);
    toast('تم حذف الاتصال', 'success');
    reloadConnections();
  };

  const handleCreateAIProvider = async () => {
    if (!user || !aiKey) return;
    // Model selection is owned by Smart AI Router and is not user-configurable.
    const selectedModel = aiProvider === 'openrouter'
      ? 'openrouter/free'
      : (AI_PROVIDER_OPTIONS.find((p) => p.code === aiProvider)?.models[0] ?? 'auto');
    await createAIProvider(user.id, aiProvider, selectedModel, aiKey, aiPriority);
    toast('تم إضافة مزود AI', 'success');
    setShowAIModal(false); setAIModel(''); setAIKey(''); setAIPriority(0);
    reloadAIProviders();
  };

  const handleDeleteAIProvider = async (id: string) => {
    if (!user) return;
    await deleteAIProvider(user.id, id);
    toast('تم حذف المزود', 'success');
    reloadAIProviders();
  };

  const handleToggleAIProvider = async (id: string, active: boolean) => {
    if (!user) return;
    await updateAIProvider(user.id, id, { is_active: active });
    reloadAIProviders();
  };

  const handleSaveSettings = async () => {
    if (!user || !settings) return;
    await updateSettings(user.id, settings);
    toast('تم حفظ الإعدادات', 'success');
  };

  if (!settings) {
    return <div className="p-6"><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الإعدادات</h1>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة إعدادات النظام</p>
          {onEnterAdmin && (
            <Button variant="secondary" onClick={onEnterAdmin}>
              <ShieldCheck className="w-4 h-4" /> لوحة الإدارة
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                  style={active
                    ? { background: 'rgb(var(--accent))', color: 'white' }
                    : { color: 'rgb(var(--text-secondary))' }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgb(var(--bg-secondary))'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'profile' && (
            <Card className="p-5 space-y-4">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الملف الشخصي</h3>
              <Input label="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input label="الشركة" value={company} onChange={(e) => setCompany(e.target.value)} />
              <Input label="المسمى الوظيفي" value={role} onChange={(e) => setRole(e.target.value)} />
              <Button onClick={handleSaveProfile}><Save className="w-4 h-4" /> حفظ</Button>
            </Card>
          )}

          {tab === 'ai_providers' && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>مزودي AI</h3>
                <Button onClick={() => setShowAIModal(true)}><Plus className="w-4 h-4" /> إضافة مزود</Button>
              </div>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>أضف مفاتيح API لمزودي AI. يتم تخزين المفاتيح بشكل آمن ولا تظهر في الواجهة.</p>
              {aiProviders.length === 0 ? (
                <div className="text-center py-8">
                  <Cpu className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد مزودين مضافين. أضف مزود AI لبدء التحليل الذكي.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {aiProviders.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgb(var(--accent-soft))' }}>
                          <Key className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{p.provider}</p>
                          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الأولوية: {p.priority} · {p.api_key_encrypted ? 'مفتاح محفوظ' : 'لا يوجد مفتاح'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle checked={p.is_active} onChange={(v) => handleToggleAIProvider(p.id, v)} />
                        <button onClick={() => handleDeleteAIProvider(p.id)} className="btn btn-ghost p-1.5" style={{ color: 'rgb(var(--danger))' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'source_connections' && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>اتصالات المصادر</h3>
                <Button onClick={() => setShowConnModal(true)}><Plus className="w-4 h-4" /> إضافة اتصال</Button>
              </div>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>اربط حساباتك مع مصادر البحث. مفاتيح Web Search المركزية تُدار من لوحة Super Admin، ويمكن استخدام اتصال مستخدم كـOverride اختياري.</p>
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Plug className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد اتصالات. أضف اتصالاً لمصدر بحث لبدء جمع البيانات.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connections.map((c) => {
                    const src = sources.find((s) => s.id === c.source_id);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgb(var(--accent-soft))' }}>
                            <Plug className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{c.name}</p>
                            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{src?.name ?? 'مصدر'}{src?.code === 'web_search' ? ' · Override اختياري' : ''} · {c.last_test_result ?? 'لم يتم الاختبار'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {src?.code === 'web_search' && <Badge>Override</Badge>}
                          {c.status === 'connected' && <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> متصل</Badge>}
                          {c.status === 'error' && <Badge variant="danger"><XCircle className="w-3 h-3" /> خطأ</Badge>}
                          {c.status === 'untested' && <Badge>غير مختبر</Badge>}
                          {c.status === 'disconnected' && <Badge>غير متصل</Badge>}
                          <button onClick={() => handleTestConnection(c.id)} disabled={testing === c.id} className="btn btn-secondary p-2">
                            {testing === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleDeleteConnection(c.id)} className="btn btn-ghost p-2" style={{ color: 'rgb(var(--danger))' }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === 'scoring' && settings && (
            <Card className="p-5 space-y-4">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>إعدادات التقييم</h3>
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>اضبط أوزان عوامل التقييم (المجموع يجب أن يكون 100)</p>
              <div className="space-y-3">
                {Object.entries(settings.scoring_config.weights).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-sm flex-1" style={{ color: 'rgb(var(--text-secondary))' }}>{WEIGHT_LABELS[key] ?? key}</label>
                    <input
                      type="number" min={0} max={100}
                      className="input w-20"
                      value={val}
                      onChange={(e) => {
                        const w = { ...settings.scoring_config.weights, [key]: Number(e.target.value) };
                        setSettings({ ...settings, scoring_config: { ...settings.scoring_config, weights: w } });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="border-t pt-3" style={{ borderColor: 'rgb(var(--border))' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>حدود التصنيف</p>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="HOT" type="number" value={settings.scoring_config.thresholds.hot} onChange={(e) => {
                    const t = { ...settings.scoring_config.thresholds, hot: Number(e.target.value) };
                    setSettings({ ...settings, scoring_config: { ...settings.scoring_config, thresholds: t } });
                  }} />
                  <Input label="HIGH" type="number" value={settings.scoring_config.thresholds.high} onChange={(e) => {
                    const t = { ...settings.scoring_config.thresholds, high: Number(e.target.value) };
                    setSettings({ ...settings, scoring_config: { ...settings.scoring_config, thresholds: t } });
                  }} />
                  <Input label="MEDIUM" type="number" value={settings.scoring_config.thresholds.medium} onChange={(e) => {
                    const t = { ...settings.scoring_config.thresholds, medium: Number(e.target.value) };
                    setSettings({ ...settings, scoring_config: { ...settings.scoring_config, thresholds: t } });
                  }} />
                </div>
              </div>
              <Button onClick={handleSaveSettings}><Save className="w-4 h-4" /> حفظ الإعدادات</Button>
            </Card>
          )}

          {tab === 'phone_rules' && settings && (
            <Card className="p-5 space-y-4">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>قواعد الهاتف</h3>
              <div>
                <label className="label">الرقم الدولي</label>
                <input className="input" value={settings.phone_rules.international_prefix} onChange={(e) => setSettings({ ...settings, phone_rules: { ...settings.phone_rules, international_prefix: e.target.value } })} />
              </div>
              <div>
                <label className="label">البادئات المقبولة (مفصولة بفاصلة)</label>
                <input className="input" value={settings.phone_rules.accept_prefixes.join(', ')} onChange={(e) => setSettings({ ...settings, phone_rules: { ...settings.phone_rules, accept_prefixes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} />
              </div>
              <Toggle checked={settings.phone_rules.reject_landlines} onChange={(v) => setSettings({ ...settings, phone_rules: { ...settings.phone_rules, reject_landlines: v } })} label="رفض الأرقام الأرضية" />
              <Button onClick={handleSaveSettings}><Save className="w-4 h-4" /> حفظ</Button>
            </Card>
          )}

          {tab === 'duplicate_rules' && settings && (
            <Card className="p-5 space-y-4">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>قواعد التكرار</h3>
              <div className="space-y-3">
                <Toggle checked={settings.duplicate_rules.exact_phone} onChange={(v) => setSettings({ ...settings, duplicate_rules: { ...settings.duplicate_rules, exact_phone: v } })} label="تطابق الهاتف بالضبط" />
                <Toggle checked={settings.duplicate_rules.exact_email} onChange={(v) => setSettings({ ...settings, duplicate_rules: { ...settings.duplicate_rules, exact_email: v } })} label="تطابق البريد بالضبط" />
                <Toggle checked={settings.duplicate_rules.exact_website} onChange={(v) => setSettings({ ...settings, duplicate_rules: { ...settings.duplicate_rules, exact_website: v } })} label="تطابق الموقع بالضبط" />
                <Toggle checked={settings.duplicate_rules.name_business_location} onChange={(v) => setSettings({ ...settings, duplicate_rules: { ...settings.duplicate_rules, name_business_location: v } })} label="اسم + نشاط + موقع" />
              </div>
              <div>
                <label className="label">حد التشابه الضبابي (%)</label>
                <input type="number" min={0} max={100} className="input w-32" value={settings.duplicate_rules.fuzzy_threshold} onChange={(e) => setSettings({ ...settings, duplicate_rules: { ...settings.duplicate_rules, fuzzy_threshold: Number(e.target.value) } })} />
              </div>
              <Button onClick={handleSaveSettings}><Save className="w-4 h-4" /> حفظ</Button>
            </Card>
          )}
        </div>
      </div>

      {/* Connection Modal */}
      {showConnModal && (
        <Modal open={true} onClose={() => setShowConnModal(false)} title="إضافة اتصال مصدر">
          <div className="space-y-4">
            <Select label="المصدر" value={connSource} onChange={(e) => setConnSource(e.target.value)}>
              <option value="">اختر مصدراً</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="اسم الاتصال" value={connName} onChange={(e) => setConnName(e.target.value)} placeholder="حسابي على Google Maps" />
            {connSource && (() => {
              const src = sources.find((s) => s.id === connSource);
              if (!src) return null;
              if (src.code === 'web_search') {
                return (
                  <div className="rounded-xl p-3 text-sm" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--text-secondary))' }}>
                    مفتاح Tavily الأساسي يُدار بأمان من <strong>Super Admin &gt; مركز الذكاء والتكاملات</strong>، وتستخدمه الحملات تلقائيًا. لا تحتاج لإضافة اتصال Web Search هنا؛ اتصال المستخدم الموجود يُعامل كـOverride اختياري فقط للحساب الحالي.
                  </div>
                );
              }
              if (src.auth_type === 'oauth' && (src.code === 'linkedin' || src.code === 'facebook')) {
                const providerLabel = src.code === 'linkedin' ? 'LinkedIn' : 'Facebook';
                return (
                  <div className="space-y-3 rounded-xl p-4" style={{ background: 'rgb(var(--accent-soft))' }}>
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 mt-0.5" style={{ color: 'rgb(var(--accent))' }} />
                      <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        سيتم فتح صفحة {providerLabel} الرسمية للموافقة. لن نطلب منك نسخ Access Token، ولن يظهر الرمز داخل التطبيق.
                      </p>
                    </div>
                    <Button onClick={() => handleOAuthConnect(src.code as 'linkedin' | 'facebook')} disabled={oauthConnecting !== null}>
                      {oauthConnecting === src.code ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                      ربط حساب {providerLabel} عبر OAuth
                    </Button>
                  </div>
                );
              }
              const fields = src.auth_type === 'api_key' ? ['api_key'] : [];
              return fields.map((f) => (
                <Input key={f} label="API Key" type="password" value={connCreds[f] ?? ''} onChange={(e) => setConnCreds({ ...connCreds, [f]: e.target.value })} />
              ));
            })()}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowConnModal(false)}>إلغاء</Button>
              {(() => {
                const src = sources.find((s) => s.id === connSource);
                return src?.auth_type !== 'oauth' && src?.code !== 'web_search' ? <Button onClick={handleCreateConnection}>إضافة</Button> : null;
              })()}
            </div>
          </div>
        </Modal>
      )}

      {/* AI Provider Modal */}
      {showAIModal && (
        <Modal open={true} onClose={() => setShowAIModal(false)} title="إضافة مزود AI">
          <div className="space-y-4">
            <Select label="المزود" value={aiProvider} onChange={(e) => { setAIProvider(e.target.value as AIProviderCode); setAIModel(''); }}>
              {AI_PROVIDER_OPTIONS.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
            <div className="rounded-xl p-3 text-sm" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--text-secondary))' }}>
              أدخل مفتاح API فقط. سيختار Smart AI Router النموذج المناسب تلقائياً، وينتقل إلى نموذج بديل أو مزود آخر عند الفشل؛ لا يوجد اختيار يدوي للنماذج.
            </div>
            <Input label="API Key" type="password" value={aiKey} onChange={(e) => setAIKey(e.target.value)} placeholder="sk-..." />
            <Input label="الأولوية" type="number" value={aiPriority} onChange={(e) => setAIPriority(Number(e.target.value))} min={0} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowAIModal(false)}>إلغاء</Button>
              <Button onClick={handleCreateAIProvider}>إضافة</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const WEIGHT_LABELS: Record<string, string> = {
  phone: 'رقم الهاتف',
  intent: 'النية',
  location: 'الموقع',
  business: 'النشاط',
  data_completeness: 'اكتمال البيانات',
  multiple_sources: 'مصادر متعددة',
  source_quality: 'جودة المصدر',
  recency: 'الحداثة',
};

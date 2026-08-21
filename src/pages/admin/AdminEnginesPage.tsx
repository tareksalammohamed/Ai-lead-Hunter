// ============================================================
// Research Engine + Lead Scoring + Phone Rules + Duplicate Engine
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getResearchEngineConfig, updateResearchEngineConfig, applyResearchPreset,
  getAdminScoringConfig, updateAdminScoringConfig,
  getAdminPhoneRules, updateAdminPhoneRules,
  getDuplicateEngineConfig, updateDuplicateEngineConfig,
  getIntentCategories, createIntentCategory, updateIntentCategory, deleteIntentCategory,
} from '@/lib/admin-services';
import type { ResearchEngineConfig, AdminScoringConfig, AdminPhoneRules, DuplicateEngineConfig, IntentCategory } from '@/types';
import { Card, Button, Input, Toggle, Skeleton, Badge } from '@/components/ui';
import { Activity, Star, Phone, Copy, Save, Zap, Plus, Trash2, Check, X } from 'lucide-react';

// ============================================================
// Research Engine
// ============================================================
export function AdminResearchEnginePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<ResearchEngineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { (async () => { setConfig(await getResearchEngineConfig()); setLoading(false); })(); }, []);

  const update = (field: keyof ResearchEngineConfig, value: number) => { setConfig((c) => c ? { ...c, [field]: value } : c); setDirty(true); };

  const handleSave = async () => {
    if (!user || !config) return;
    await updateResearchEngineConfig(user.id, config);
    toast('تم حفظ إعدادات المحرك', 'success'); setDirty(false);
  };

  const handlePreset = async (preset: 'conservative' | 'balanced' | 'aggressive') => {
    if (!user) return;
    await applyResearchPreset(user.id, preset);
    setConfig(await getResearchEngineConfig());
    toast(`تم تطبيق الإعداد: ${preset}`, 'success'); setDirty(false);
  };

  if (loading || !config) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const fields: { key: keyof ResearchEngineConfig; label: string; desc: string }[] = [
    { key: 'max_concurrent_jobs', label: 'الحد الأقصى للوظائف المتزامنة', desc: 'عدد وظائف البحث التي تعمل في نفس الوقت' },
    { key: 'max_leads_per_job', label: 'الحد الأقصى للعملاء لكل وظيفة', desc: 'عدد العملاء الأقصى لكل وظيفة بحث' },
    { key: 'max_search_depth', label: 'عمق البحث الأقصى', desc: 'عدد صفحات نتائج البحث' },
    { key: 'request_timeout_ms', label: 'مهلة الطلب (ms)', desc: 'مهلة طلب البحث' },
    { key: 'retry_attempts', label: 'محاولات إعادة المحاولة', desc: 'عدد المحاولات عند الفشل' },
    { key: 'delay_between_requests_ms', label: 'التأخير بين الطلبات (ms)', desc: 'التأخير لتجنب الحظر' },
    { key: 'daily_research_limit', label: 'الحد اليومي للبحث', desc: 'الحد الأقصى لعمليات البحث اليومية' },
    { key: 'max_sources_per_campaign', label: 'الحد الأقصى للمصادر لكل حملة', desc: 'عدد المصادر الأقصى' },
    { key: 'ai_qualification_threshold', label: 'حد تأهيل AI', desc: 'الحد الأدنى لتأهيل العميل' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>محرك البحث</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إعدادات محرك البحث الذكي</p>
      </div>

      {/* Presets */}
      <Card className="p-4">
        <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>إعدادات جاهزة</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['conservative', 'balanced', 'aggressive'] as const).map((p) => (
            <Button key={p} variant="secondary" onClick={() => handlePreset(p)}>
              <Zap className="w-4 h-4" />
              {p === 'conservative' ? 'حذر' : p === 'balanced' ? 'متوازن' : 'هجومي'}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-4">
            <div className="flex-1">
              <label className="label">{f.label}</label>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{f.desc}</p>
            </div>
            <Input type="number" className="w-32" value={config[f.key]} onChange={(e) => update(f.key, Number(e.target.value))} />
          </div>
        ))}
      </Card>

      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave}><Save className="w-4 h-4" /> حفظ الإعدادات</Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Lead Scoring
// ============================================================
export function AdminLeadScoringPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<AdminScoringConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [categories, setCategories] = useState<IntentCategory[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', description: '', ai_instructions: '', weight: 10 });

  useEffect(() => { (async () => {
    setConfig(await getAdminScoringConfig());
    setCategories(await getIntentCategories());
    setLoading(false);
  })(); }, []);

  const weightSum = config ? Object.values(config.weights).reduce((a, b) => a + b, 0) : 0;

  const updateWeight = (key: keyof AdminScoringConfig['weights'], value: number) => {
    setConfig((c) => c ? { ...c, weights: { ...c.weights, [key]: value } } : c); setDirty(true);
  };
  const updateThreshold = (key: keyof AdminScoringConfig['thresholds'], value: number) => {
    setConfig((c) => c ? { ...c, thresholds: { ...c.thresholds, [key]: value } } : c); setDirty(true);
  };

  const handleSave = async () => {
    if (!user || !config) return;
    try {
      await updateAdminScoringConfig(user.id, config);
      toast('تم حفظ إعدادات التقييم', 'success'); setDirty(false);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const handleCreateCat = async () => {
    if (!user || !newCat.name) return;
    await createIntentCategory(user.id, newCat.name, newCat.description, newCat.ai_instructions, newCat.weight);
    setCategories(await getIntentCategories());
    setShowNewCat(false); setNewCat({ name: '', description: '', ai_instructions: '', weight: 10 });
    toast('تم إنشاء الفئة', 'success');
  };

  const handleToggleCat = async (id: string, enabled: boolean) => {
    if (!user) return;
    await updateIntentCategory(user.id, id, { enabled });
    setCategories(await getIntentCategories());
  };

  const handleDeleteCat = async (id: string) => {
    if (!user) return;
    await deleteIntentCategory(user.id, id);
    setCategories(await getIntentCategories());
    toast('تم حذف الفئة', 'success');
  };

  if (loading || !config) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const weightLabels: Record<string, string> = {
    phone: 'رقم الهاتف', intent: 'النية', location: 'الموقع', business: 'النشاط',
    multiple_sources: 'مصادر متعددة', data_completeness: 'اكتمال البيانات', source_quality: 'جودة المصدر', recency: 'الحداثة',
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>تقييم العملاء</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إعدادات أوزان التقييم</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الأوزان</h3>
          <Badge variant={weightSum === 100 ? 'success' : 'danger'}>المجموع: {weightSum} / 100</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(config.weights).map(([key, val]) => (
            <div key={key}>
              <label className="label">{weightLabels[key] ?? key}</label>
              <Input type="number" min={0} max={100} value={val} onChange={(e) => updateWeight(key as any, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>حدود التصنيف</h3>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">HOT</label><Input type="number" value={config.thresholds.hot} onChange={(e) => updateThreshold('hot', Number(e.target.value))} /></div>
          <div><label className="label">HIGH</label><Input type="number" value={config.thresholds.high} onChange={(e) => updateThreshold('high', Number(e.target.value))} /></div>
          <div><label className="label">MEDIUM</label><Input type="number" value={config.thresholds.medium} onChange={(e) => updateThreshold('medium', Number(e.target.value))} /></div>
        </div>
      </Card>

      {/* Preview */}
      <Card className="p-5">
        <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>مثال على التقييم</h3>
        <div className="p-4 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
          <div className="space-y-1 text-sm">
            {Object.entries(config.weights).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span style={{ color: 'rgb(var(--text-secondary))' }}>{weightLabels[key] ?? key}</span>
                <span style={{ color: 'rgb(var(--text-primary))' }}>{val} نقطة</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <span style={{ color: 'rgb(var(--text-primary))' }}>النتيجة الكاملة</span>
              <span style={{ color: weightSum === 100 ? 'rgb(var(--success))' : 'rgb(var(--danger))' }}>{weightSum}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Intent Categories */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>فئات النية</h3>
          <Button variant="secondary" onClick={() => setShowNewCat(true)}><Plus className="w-4 h-4" /> فئة جديدة</Button>
        </div>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
              <div className="flex items-center gap-3">
                <Toggle checked={c.enabled} onChange={(v) => handleToggleCat(c.id, v)} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{c.description} · وزن: {c.weight}</p>
                </div>
              </div>
              <button onClick={() => handleDeleteCat(c.id)} className="btn btn-ghost p-1.5" style={{ color: 'rgb(var(--danger))' }}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </Card>

      {showNewCat && (
        <Card className="p-5 space-y-3">
          <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>فئة نية جديدة</h3>
          <Input label="الاسم" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <Input label="الوصف" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} />
          <Input label="تعليمات AI" value={newCat.ai_instructions} onChange={(e) => setNewCat({ ...newCat, ai_instructions: e.target.value })} />
          <Input label="الوزن" type="number" value={newCat.weight} onChange={(e) => setNewCat({ ...newCat, weight: Number(e.target.value) })} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowNewCat(false)}>إلغاء</Button>
            <Button onClick={handleCreateCat}>إنشاء</Button>
          </div>
        </Card>
      )}

      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave}><Save className="w-4 h-4" /> حفظ</Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Phone Rules
// ============================================================
export function AdminPhoneRulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<AdminPhoneRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { (async () => { setRules(await getAdminPhoneRules()); setLoading(false); })(); }, []);

  const update = (field: keyof AdminPhoneRules, value: any) => { setRules((r) => r ? { ...r, [field]: value } : r); setDirty(true); };

  const handleSave = async () => {
    if (!user || !rules) return;
    await updateAdminPhoneRules(user.id, rules);
    toast('تم حفظ قواعد الهاتف', 'success'); setDirty(false);
  };

  if (loading || !rules) return <div className="p-6"><Skeleton className="h-64" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>قواعد الهاتف</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إعدادات تطبيع الأرقام المصرية</p>
      </div>

      <Card className="p-5 space-y-4">
        <div><label className="label">رمز الدولة</label><Input value={rules.country_code} onChange={(e) => update('country_code', e.target.value)} /></div>
        <div>
          <label className="label">بادئات الموبايل (مفصولة بفاصلة)</label>
          <Input value={rules.mobile_prefixes.join(', ')} onChange={(e) => update('mobile_prefixes', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </div>
        <div className="space-y-3">
          <Toggle checked={rules.require_mobile} onChange={(v) => update('require_mobile', v)} label="يشترط موبايل" />
          <Toggle checked={rules.allow_landline} onChange={(v) => update('allow_landline', v)} label="السماح بالأرقام الأرضية" />
          <Toggle checked={rules.verify_format} onChange={(v) => update('verify_format', v)} label="التحقق من الصيغة" />
          <Toggle checked={rules.normalize_automatically} onChange={(v) => update('normalize_automatically', v)} label="التطبيع التلقائي" />
          <Toggle checked={rules.reject_invalid} onChange={(v) => update('reject_invalid', v)} label="رفض الأرقام غير الصحيحة" />
        </div>
      </Card>

      {dirty && <div className="flex justify-end"><Button onClick={handleSave}><Save className="w-4 h-4" /> حفظ</Button></div>}
    </div>
  );
}

// ============================================================
// Duplicate Engine
// ============================================================
export function AdminDuplicateEnginePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<DuplicateEngineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { (async () => { setConfig(await getDuplicateEngineConfig()); setLoading(false); })(); }, []);

  const update = (field: keyof DuplicateEngineConfig, value: number) => { setConfig((c) => c ? { ...c, [field]: value } : c); setDirty(true); };

  const handleSave = async () => {
    if (!user || !config) return;
    await updateDuplicateEngineConfig(user.id, config);
    toast('تم حفظ إعدادات التكرار', 'success'); setDirty(false);
  };

  if (loading || !config) return <div className="p-6"><Skeleton className="h-64" /></div>;

  const weightFields: { key: keyof DuplicateEngineConfig; label: string }[] = [
    { key: 'phone_match_weight', label: 'وزن مطابقة الهاتف' },
    { key: 'email_match_weight', label: 'وزن مطابقة البريد' },
    { key: 'name_match_weight', label: 'وزن مطابقة الاسم' },
    { key: 'business_match_weight', label: 'وزن مطابقة النشاط' },
    { key: 'location_match_weight', label: 'وزن مطابقة الموقع' },
    { key: 'website_match_weight', label: 'وزن مطابقة الموقع الإلكتروني' },
  ];
  const thresholdFields: { key: keyof DuplicateEngineConfig; label: string; desc: string }[] = [
    { key: 'auto_merge_threshold', label: 'حد الدمج التلقائي', desc: 'فوق هذا النسبة يتم الدمج تلقائياً' },
    { key: 'potential_duplicate_threshold', label: 'حد التكرار المحتمل', desc: 'بين هذا الحد وحد الدمج يحتاج مراجعة' },
    { key: 'keep_separate_threshold', label: 'حد الإبقاء منفصلاً', desc: 'تحت هذا الحد يبقى العملاء منفصلين' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>محرك التكرار</h1>
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إعدادات كشف التكرار ودمج العملاء</p>
      </div>

      <Card className="p-5">
        <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>أوزان المطابقة</h3>
        <div className="grid grid-cols-2 gap-3">
          {weightFields.map((f) => (
            <div key={f.key}><label className="label">{f.label}</label><Input type="number" min={0} max={100} value={config[f.key]} onChange={(e) => update(f.key, Number(e.target.value))} /></div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>الحدود</h3>
        <div className="space-y-3">
          {thresholdFields.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <Input type="number" min={0} max={100} value={config[f.key]} onChange={(e) => update(f.key, Number(e.target.value))} />
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {dirty && <div className="flex justify-end"><Button onClick={handleSave}><Save className="w-4 h-4" /> حفظ</Button></div>}
    </div>
  );
}

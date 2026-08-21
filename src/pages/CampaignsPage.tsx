// ============================================================
// Campaigns — Full CRUD with create, edit, duplicate, start, pause, archive, delete
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getCampaigns, createCampaign, updateCampaign, duplicateCampaign,
  deleteCampaign, setCampaignStatus, getSources,
} from '@/lib/services';
import type { Campaign, CampaignInput, Source, SourceCode } from '@/types';
import { Card, Button, Input, Textarea, Select, Toggle, Modal, EmptyState, Skeleton, Badge } from '@/components/ui';
import type { PageKey } from '@/components/AppLayout';
import {
  Plus, Target, Edit2, Copy, Trash2, Play, Pause, Archive, ArrowLeft,
  MapPin, Tag, Users, X,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة', active: 'نشطة', paused: 'متوقفة', completed: 'مكتملة', archived: 'مؤرشفة',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', active: 'success', paused: 'warning', completed: 'info', archived: 'default',
};

export function CampaignsPage({ onNavigate, onSelectCampaign }: { onNavigate: (page: PageKey) => void; onSelectCampaign: (id: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [c, s] = await Promise.all([getCampaigns(user.id), getSources()]);
    setCampaigns(c);
    setSources(s);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleSave = async (input: CampaignInput) => {
    if (!user) return;
    if (editingCampaign) {
      await updateCampaign(user.id, editingCampaign.id, input);
      toast('تم تحديث الحملة', 'success');
    } else {
      await createCampaign(user.id, input);
      toast('تم إنشاء الحملة', 'success');
    }
    setModalOpen(false);
    setEditingCampaign(null);
    loadData();
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    await duplicateCampaign(user.id, id);
    toast('تم نسخ الحملة', 'success');
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteCampaign(user.id, id);
    toast('تم حذف الحملة', 'success');
    setConfirmDelete(null);
    loadData();
  };

  const handleStatusChange = async (id: string, status: Campaign['status']) => {
    if (!user) return;
    await setCampaignStatus(user.id, id, status);
    toast('تم تحديث حالة الحملة', 'success');
    loadData();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>الحملات</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>إدارة حملات البحث عن العملاء</p>
        </div>
        <Button onClick={() => { setEditingCampaign(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4" />
          حملة جديدة
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Target}
            title="لا توجد حملات حتى الآن"
            description="أنشئ أول حملة بحث لتبدأ في جمع العملاء المحتملين تلقائياً"
            action={<Button onClick={() => { setEditingCampaign(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> إنشاء حملة</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} hover className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate" style={{ color: 'rgb(var(--text-primary))' }}>{c.name}</h3>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                    {new Date(c.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
              </div>

              <p className="text-sm mb-3 line-clamp-2" style={{ color: 'rgb(var(--text-secondary))' }}>{c.objective || 'لا يوجد وصف'}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{[c.city, c.governorate, c.country].filter(Boolean).join('، ') || 'غير محدد'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  <Tag className="w-3.5 h-3.5" />
                  <span>{c.keywords.length} كلمات مفتاحية</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  <Users className="w-3.5 h-3.5" />
                  <span>حد أقصى: {c.max_leads} عميل</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {c.sources.map((s) => {
                  const src = sources.find((x) => x.code === s);
                  return <Badge key={s} variant="info">{src?.name ?? s}</Badge>;
                })}
              </div>

              <div className="flex items-center gap-1 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <button onClick={() => onSelectCampaign(c.id)} className="btn btn-ghost flex-1 p-2 text-xs" title="مركز التحكم">
                  <Play className="w-3.5 h-3.5" />
                  بدء البحث
                </button>
                <button onClick={() => { setEditingCampaign(c); setModalOpen(true); }} className="btn btn-ghost p-2" title="تعديل">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDuplicate(c.id)} className="btn btn-ghost p-2" title="نسخ">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {c.status === 'active' && (
                  <button onClick={() => handleStatusChange(c.id, 'paused')} className="btn btn-ghost p-2" title="إيقاف">
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}
                {c.status === 'paused' && (
                  <button onClick={() => handleStatusChange(c.id, 'active')} className="btn btn-ghost p-2" title="استئناف">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => handleStatusChange(c.id, 'archived')} className="btn btn-ghost p-2" title="أرشفة">
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(c.id)} className="btn btn-ghost p-2" title="حذف" style={{ color: 'rgb(var(--danger))' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <CampaignModal
          campaign={editingCampaign}
          sources={sources}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingCampaign(null); }}
        />
      )}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="تأكيد الحذف">
        <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>
          هل أنت متأكد من حذف هذه الحملة؟ سيتم حذف جميع البيانات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
          <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>حذف</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---- Campaign Modal ----
function CampaignModal({ campaign, sources, onSave, onClose }: {
  campaign: Campaign | null;
  sources: Source[];
  onSave: (input: CampaignInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CampaignInput>({
    name: campaign?.name ?? '',
    objective: campaign?.objective ?? '',
    country: campaign?.country ?? 'Egypt',
    governorate: campaign?.governorate ?? '',
    city: campaign?.city ?? '',
    area: campaign?.area ?? '',
    keywords: campaign?.keywords ?? [],
    negative_keywords: campaign?.negative_keywords ?? [],
    target_audience: campaign?.target_audience ?? '',
    sources: campaign?.sources ?? [],
    max_leads: campaign?.max_leads ?? 500,
    min_score: campaign?.min_score ?? 50,
    require_phone: campaign?.require_phone ?? true,
    require_egyptian_mobile: campaign?.require_egyptian_mobile ?? true,
    ai_instructions: campaign?.ai_instructions ?? '',
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [negKeywordInput, setNegKeywordInput] = useState('');

  const update = (field: keyof CampaignInput, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const addKeyword = () => {
    if (keywordInput.trim()) {
      update('keywords', [...form.keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };
  const removeKeyword = (i: number) => update('keywords', form.keywords.filter((_, idx) => idx !== i));

  const addNegKeyword = () => {
    if (negKeywordInput.trim()) {
      update('negative_keywords', [...form.negative_keywords, negKeywordInput.trim()]);
      setNegKeywordInput('');
    }
  };
  const removeNegKeyword = (i: number) => update('negative_keywords', form.negative_keywords.filter((_, idx) => idx !== i));

  const toggleSource = (code: SourceCode) => {
    update('sources', form.sources.includes(code)
      ? form.sources.filter((s) => s !== code)
      : [...form.sources, code]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal open={true} onClose={onClose} title={campaign ? 'تعديل الحملة' : 'حملة جديدة'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الحملة" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="مثال: تأمين على الحياة - طنطا" required />

        <Textarea label="الهدف (وصف طبيعي)" value={form.objective} onChange={(e) => update('objective', e.target.value)} placeholder="مثال: أريد 300 عميل محتمل للتأمين على الحياة في طنطا والمحلة..." rows={3} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="الدولة" value={form.country} onChange={(e) => update('country', e.target.value)} />
          <Input label="المحافظة" value={form.governorate ?? ''} onChange={(e) => update('governorate', e.target.value)} placeholder="الغربية" />
          <Input label="المدينة" value={form.city ?? ''} onChange={(e) => update('city', e.target.value)} placeholder="طنطا" />
          <Input label="المنطقة" value={form.area ?? ''} onChange={(e) => update('area', e.target.value)} placeholder="وسط البلد" />
        </div>

        <Input label="الجمهور المستهدف" value={form.target_audience ?? ''} onChange={(e) => update('target_audience', e.target.value)} placeholder="أصحاب الأعمال، المهتمين بالادخار" />

        {/* Keywords */}
        <div>
          <label className="label">الكلمات المفتاحية</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              placeholder="تأمين على الحياة"
            />
            <Button type="button" variant="secondary" onClick={addKeyword}><Plus className="w-4 h-4" /></Button>
          </div>
          {form.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.keywords.map((kw, i) => (
                <span key={i} className="badge" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                  {kw}
                  <button type="button" onClick={() => removeKeyword(i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Negative Keywords */}
        <div>
          <label className="label">الكلمات المستبعدة</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={negKeywordInput}
              onChange={(e) => setNegKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNegKeyword(); } }}
              placeholder="spam, إعلان"
            />
            <Button type="button" variant="secondary" onClick={addNegKeyword}><Plus className="w-4 h-4" /></Button>
          </div>
          {form.negative_keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.negative_keywords.map((kw, i) => (
                <span key={i} className="badge" style={{ background: 'rgb(var(--danger-soft))', color: 'rgb(var(--danger))' }}>
                  {kw}
                  <button type="button" onClick={() => removeNegKeyword(i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sources */}
        <div>
          <label className="label">مصادر البحث</label>
          <div className="grid grid-cols-2 gap-2">
            {sources.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => toggleSource(s.code)}
                className="flex items-center gap-2 p-3 rounded-xl border transition-all text-right"
                style={form.sources.includes(s.code)
                  ? { borderColor: 'rgb(var(--accent))', background: 'rgb(var(--accent-soft))' }
                  : { borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{s.name}</p>
                  <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>{s.description}</p>
                </div>
                {form.sources.includes(s.code) && <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgb(var(--accent))' }}><span className="text-white text-xs">✓</span></div>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="حد أقصى للعملاء" type="number" value={form.max_leads} onChange={(e) => update('max_leads', Number(e.target.value))} min={1} />
          <Input label="حد أدنى للنتيجة" type="number" value={form.min_score} onChange={(e) => update('min_score', Number(e.target.value))} min={0} max={100} />
        </div>

        <div className="space-y-2">
          <Toggle checked={form.require_phone} onChange={(v) => update('require_phone', v)} label="يشترط وجود رقم هاتف" />
          <Toggle checked={form.require_egyptian_mobile} onChange={(v) => update('require_egyptian_mobile', v)} label="يشترط موبايل مصري (010/011/012/015)" />
        </div>

        <Textarea label="تعليمات AI إضافية" value={form.ai_instructions ?? ''} onChange={(e) => update('ai_instructions', e.target.value)} placeholder="ركز على أصحاب الأعمال الذين يظهرون اهتماماً بالادخار..." rows={2} />

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit">{campaign ? 'حفظ' : 'إنشاء'}</Button>
        </div>
      </form>
    </Modal>
  );
}

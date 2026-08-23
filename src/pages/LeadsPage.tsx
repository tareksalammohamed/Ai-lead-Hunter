// ============================================================
// Leads — Table with filters, server-side pagination, CSV export
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getLeads, getCampaigns, deleteLead } from '@/lib/services';
import type { Lead, Campaign } from '@/types';
import { Card, Button, Input, Select, EmptyState, Skeleton, ScoreBadge, Modal } from '@/components/ui';
import { exportLeadsCSV, type ExportField } from '@/lib/export';
import {
  Users, Search, Download, Trash2, ArrowLeft, Phone, Mail, MapPin,
  Star, Filter, ChevronRight, X,
} from 'lucide-react';

const PAGE_SIZE = 20;

export function LeadsPage({ onSelectLead }: { onSelectLead: (id: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [filterIntent, setFilterIntent] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'newest'>('score');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [l, c] = await Promise.all([getLeads(user.id), getCampaigns(user.id)]);
      setLeads(l);
      setCampaigns(c);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        const match = l.name?.toLowerCase().includes(q) || l.business?.toLowerCase().includes(q) || l.normalized_phone?.includes(q) || l.email?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterCity && l.city !== filterCity) return false;
      if (filterScore && l.score_tier !== filterScore) return false;
      if (filterIntent && l.intent !== filterIntent) return false;
      if (filterCampaign && l.campaign_id !== filterCampaign) return false;
      if (filterPhone === 'yes' && !l.normalized_phone) return false;
      if (filterPhone === 'no' && l.normalized_phone) return false;
      if (filterStatus && l.status !== filterStatus) return false;
      return true;
    });
  }, [leads, search, filterCity, filterScore, filterIntent, filterCampaign, filterPhone, filterStatus]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ar');
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return (b.score ?? 0) - (a.score ?? 0);
  }), [filtered, sortBy]);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const cities = useMemo(() => [...new Set(leads.map((l) => l.city).filter(Boolean))] as string[], [leads]);
  const intents = useMemo(() => [...new Set(leads.map((l) => l.intent))] as string[], [leads]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteLead(user.id, id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setConfirmDelete(null);
    toast('تم حذف العميل', 'success');
  };

  const handleExport = (fields: ExportField[]) => {
    exportLeadsCSV(filtered, fields);
    toast('تم تصدير البيانات', 'success');
    setShowExport(false);
  };

  const clearFilters = () => {
    setSearch(''); setFilterCity(''); setFilterScore(''); setFilterIntent('');
    setFilterCampaign(''); setFilterPhone(''); setFilterStatus('');
  };

  const hasFilters = search || filterCity || filterScore || filterIntent || filterCampaign || filterPhone || filterStatus;
  const hotCount = leads.filter((l) => l.score_tier === 'HOT').length;
  const qualifiedCount = leads.filter((l) => l.status === 'qualified').length;
  const phoneCount = leads.filter((l) => !!l.normalized_phone).length;
  const toggleSelected = (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAllVisible = () => setSelectedIds((p) => paged.every(l => p.includes(l.id)) ? p.filter(id => !paged.some(l => l.id === id)) : [...new Set([...p, ...paged.map(l => l.id)])]);

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1440px] mx-auto">
      <div className="relative overflow-hidden rounded-2xl p-5 md:p-7" style={{ background: 'linear-gradient(135deg, rgb(var(--accent-soft)), rgb(var(--bg-secondary)))', border: '1px solid rgb(var(--border))' }}>
        <div className="relative z-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--accent))' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgb(var(--accent))' }} /> AI Lead Intelligence
            </div>
            <h1 className="text-3xl md:text-4xl font-black mt-2" style={{ color: 'rgb(var(--text-primary))' }}>العملاء المحتملون</h1>
            <p className="text-sm mt-2 max-w-xl" style={{ color: 'rgb(var(--text-muted))' }}>رتّب فرصك، اكتشف العملاء الأعلى نية، وابدأ البحث الذكي من مكان واحد.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}><Filter className="w-4 h-4" /> {showFilters ? 'إخفاء الفلاتر' : 'فلاتر ذكية'}</Button>
            {leads.length > 0 && <Button onClick={() => setShowExport(true)}><Download className="w-4 h-4" /> تصدير</Button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['إجمالي العملاء', leads.length, Users],
          ['Hot Leads', hotCount, Star],
          ['مؤهلون', qualifiedCount, Star],
          ['لديهم هاتف', phoneCount, Phone],
        ].map(([label, value, Icon]: any) => (
          <Card key={label} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div><p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{label}</p><p className="text-2xl font-black mt-1" style={{ color: 'rgb(var(--text-primary))' }}>{value}</p></div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}><Icon className="w-5 h-5" /></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
          <input className="input pr-10 w-full h-11" placeholder="ابحث بالاسم، النشاط، الهاتف أو البريد..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} aria-label="ترتيب العملاء">
          <option value="score">الأعلى تقييمًا</option><option value="newest">الأحدث</option><option value="name">الاسم</option>
        </Select>
        {selectedIds.length > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
          <b>{selectedIds.length}</b> محدد
          <button className="font-bold" onClick={() => setSelectedIds([])}>إلغاء</button>
        </div>}
      </div>

      {showFilters && (
        <Card className="p-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select label="المدينة" value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setPage(0); }}><option value="">كل المدن</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</Select>
            <Select label="النتيجة" value={filterScore} onChange={(e) => { setFilterScore(e.target.value); setPage(0); }}><option value="">كل النتائج</option><option value="HOT">HOT</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option></Select>
            <Select label="النية" value={filterIntent} onChange={(e) => { setFilterIntent(e.target.value); setPage(0); }}><option value="">كل النوايا</option>{intents.map(i => <option key={i} value={i}>{i.replace(/_/g,' ')}</option>)}</Select>
            <Select label="الحملة" value={filterCampaign} onChange={(e) => { setFilterCampaign(e.target.value); setPage(0); }}><option value="">كل الحملات</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <Select label="الهاتف" value={filterPhone} onChange={(e) => { setFilterPhone(e.target.value); setPage(0); }}><option value="">كل العملاء</option><option value="yes">لديه هاتف</option><option value="no">بدون هاتف</option></Select>
            <Select label="الحالة" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}><option value="">كل الحالات</option><option value="new">جديد</option><option value="contacted">تم التواصل</option><option value="qualified">مؤهل</option><option value="disqualified">غير مؤهل</option><option value="converted">محوّل</option></Select>
          </div>
          {hasFilters && <button onClick={clearFilters} className="text-sm mt-3 flex items-center gap-1" style={{ color: 'rgb(var(--accent))' }}><X className="w-3.5 h-3.5" /> مسح كل الفلاتر</button>}
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10"><EmptyState icon={Users} title={hasFilters ? "لا توجد نتائج مطابقة" : "ابدأ ببناء قاعدة عملائك"} description={hasFilters ? "جرّب إزالة بعض الفلاتر أو تغيير كلمة البحث." : "شغّل حملة بحث وسيقوم النظام بجمع وترتيب العملاء المحتملين تلقائيًا."} /></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgb(var(--border))' }}>
              <div className="flex items-center gap-3 text-sm"><input type="checkbox" checked={paged.length > 0 && paged.every(l => selectedIds.includes(l.id))} onChange={toggleAllVisible} /><span style={{ color: 'rgb(var(--text-muted))' }}>{filtered.length} نتيجة</span></div>
              <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الأفضل أولًا</span>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead><tr style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <th className="p-3 w-10"></th>{['العميل','الهاتف','الموقع','النية','النتيجة','الحالة',''].map((x,i)=><th key={i} className="text-right p-3 text-xs font-semibold" style={{color:'rgb(var(--text-muted))'}}>{x}</th>)}
                </tr></thead>
                <tbody>{paged.map(lead => (
                  <tr key={lead.id} className="border-t cursor-pointer transition-colors hover:bg-opacity-50" style={{borderColor:'rgb(var(--border))'}} onClick={()=>onSelectLead(lead.id)}>
                    <td className="p-3" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={()=>toggleSelected(lead.id)} /></td>
                    <td className="p-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center font-black" style={{background:'rgb(var(--accent-soft))',color:'rgb(var(--accent))'}}>{lead.name?.[0] ?? '?'}</div><div><p className="text-sm font-bold" style={{color:'rgb(var(--text-primary))'}}>{lead.name}</p><p className="text-xs" style={{color:'rgb(var(--text-muted))'}}>{lead.business ?? 'نشاط غير محدد'}</p></div></div></td>
                    <td className="p-3 text-sm font-mono" style={{color:'rgb(var(--text-secondary))'}}>{lead.normalized_phone || '—'}</td>
                    <td className="p-3 text-sm" style={{color:'rgb(var(--text-secondary))'}}>{lead.city || '—'}</td>
                    <td className="p-3 text-xs font-semibold" style={{color:'rgb(var(--text-secondary))'}}>{lead.intent?.replace(/_/g,' ') || 'غير محدد'}</td>
                    <td className="p-3"><ScoreBadge score={lead.score} tier={lead.score_tier} /></td>
                    <td className="p-3"><span className="badge">{lead.status==='new'?'جديد':lead.status==='contacted'?'تم التواصل':lead.status==='qualified'?'مؤهل':lead.status==='disqualified'?'غير مؤهل':'محوّل'}</span></td>
                    <td className="p-3" onClick={e=>e.stopPropagation()}><div className="flex gap-1"><button className="btn btn-ghost p-2" onClick={()=>onSelectLead(lead.id)} title="فتح"><ChevronRight className="w-4 h-4"/></button><button className="btn btn-ghost p-2" style={{color:'rgb(var(--danger))'}} onClick={()=>setConfirmDelete(lead.id)} title="حذف"><Trash2 className="w-4 h-4"/></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="md:hidden divide-y" style={{borderColor:'rgb(var(--border))'}}>
              {paged.map(lead => (
                <button key={lead.id} className="w-full text-right p-4 flex items-center gap-3" onClick={()=>onSelectLead(lead.id)}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black flex-shrink-0" style={{background:'rgb(var(--accent-soft))',color:'rgb(var(--accent))'}}>{lead.name?.[0] ?? '?'}</div>
                  <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate" style={{color:'rgb(var(--text-primary))'}}>{lead.name}</strong><ScoreBadge score={lead.score} tier={lead.score_tier}/></div><p className="text-xs truncate mt-1" style={{color:'rgb(var(--text-muted))'}}>{lead.business || lead.city || 'عميل محتمل'}</p><p className="text-xs mt-1" style={{color:'rgb(var(--text-muted))'}}>{lead.intent?.replace(/_/g,' ') || 'نية غير محددة'} · {lead.status || 'new'}</p></div><ChevronRight className="w-4 h-4 flex-shrink-0" style={{color:'rgb(var(--text-muted))'}}/></button>
              ))}
            </div>
          </Card>
          {totalPages > 1 && <div className="flex items-center justify-between"><p className="text-sm" style={{color:'rgb(var(--text-muted))'}}>صفحة {page+1} من {totalPages}</p><div className="flex gap-2"><Button variant="secondary" disabled={page===0} onClick={()=>setPage(page-1)}>السابق</Button><Button variant="secondary" disabled={page>=totalPages-1} onClick={()=>setPage(page+1)}>التالي</Button></div></div>}
        </>
      )}

      {showExport && <ExportModal leads={filtered} onExport={handleExport} onClose={() => setShowExport(false)} />}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="تأكيد الحذف">
        <p className="text-sm mb-4" style={{color:'rgb(var(--text-secondary))'}}>سيتم حذف العميل نهائيًا من قاعدة البيانات.</p>
        <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={()=>setConfirmDelete(null)}>إلغاء</Button><Button variant="danger" onClick={()=>confirmDelete && handleDelete(confirmDelete)}>حذف العميل</Button></div>
      </Modal>
    </div>
  );
}

// ---- Export Modal ----
const ALL_EXPORT_FIELDS: { key: ExportField; label: string }[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'business', label: 'النشاط' },
  { key: 'phone', label: 'الهاتف' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'website', label: 'الموقع الإلكتروني' },
  { key: 'city', label: 'المدينة' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'address', label: 'العنوان' },
  { key: 'score', label: 'النتيجة' },
  { key: 'score_tier', label: 'تصنيف النتيجة' },
  { key: 'intent', label: 'النية' },
  { key: 'intent_score', label: 'نتيجة النية' },
  { key: 'lead_type', label: 'نوع العميل' },
  { key: 'confidence', label: 'الثقة' },
  { key: 'potential', label: 'الإمكانية' },
  { key: 'verification_status', label: 'حالة التحقق' },
  { key: 'status', label: 'الحالة' },
  { key: 'created_at', label: 'تاريخ الإنشاء' },
];

function ExportModal({ leads, onExport, onClose }: { leads: Lead[]; onExport: (fields: ExportField[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<ExportField[]>(ALL_EXPORT_FIELDS.map((f) => f.key));

  const toggle = (key: ExportField) => {
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  return (
    <Modal open={true} onClose={onClose} title="تصدير CSV" maxWidth="max-w-lg">
      <p className="text-sm mb-3" style={{ color: 'rgb(var(--text-secondary))' }}>اختر الحقول للتصدير ({leads.length} عميل)</p>
      <div className="grid grid-cols-2 gap-2 mb-4 max-h-64 overflow-y-auto">
        {ALL_EXPORT_FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg" style={{ background: selected.includes(f.key) ? 'rgb(var(--accent-soft))' : 'rgb(var(--bg-secondary))' }}>
            <input type="checkbox" checked={selected.includes(f.key)} onChange={() => toggle(f.key)} className="rounded" />
            <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{f.label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={() => onExport(selected)} disabled={selected.length === 0}>
          <Download className="w-4 h-4" />
          تصدير ({selected.length} حقل)
        </Button>
      </div>
    </Modal>
  );
}

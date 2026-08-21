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

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
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

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>العملاء</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{filtered.length} عميل</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4" />
            تصفية
          </Button>
          {leads.length > 0 && (
            <Button onClick={() => setShowExport(true)}>
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
        <input
          className="input pr-10"
          placeholder="بحث بالاسم، النشاط، الهاتف، البريد..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select label="المدينة" value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setPage(0); }}>
              <option value="">الكل</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="النتيجة" value={filterScore} onChange={(e) => { setFilterScore(e.target.value); setPage(0); }}>
              <option value="">الكل</option>
              <option value="HOT">HOT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </Select>
            <Select label="النية" value={filterIntent} onChange={(e) => { setFilterIntent(e.target.value); setPage(0); }}>
              <option value="">الكل</option>
              {intents.map((i) => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
            </Select>
            <Select label="الحملة" value={filterCampaign} onChange={(e) => { setFilterCampaign(e.target.value); setPage(0); }}>
              <option value="">الكل</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="الهاتف" value={filterPhone} onChange={(e) => { setFilterPhone(e.target.value); setPage(0); }}>
              <option value="">الكل</option>
              <option value="yes">يوجد هاتف</option>
              <option value="no">بدون هاتف</option>
            </Select>
            <Select label="الحالة" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}>
              <option value="">الكل</option>
              <option value="new">جديد</option>
              <option value="contacted">تم التواصل</option>
              <option value="qualified">مؤهل</option>
              <option value="disqualified">غير مؤهل</option>
              <option value="converted">محوّل</option>
            </Select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-sm mt-3 flex items-center gap-1" style={{ color: 'rgb(var(--accent))' }}>
              <X className="w-3.5 h-3.5" /> مسح التصفية
            </button>
          )}
        </Card>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Users}
            title={hasFilters ? "لا توجد نتائج مطابقة" : "لا توجد عملاء حتى الآن"}
            description={hasFilters ? "جرّب تعديل عوامل التصفية" : "ابدأ حملة بحث لجمع العملاء المحتملين"}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgb(var(--bg-secondary))' }}>
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>الاسم</th>
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>الهاتف</th>
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>المدينة</th>
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>النية</th>
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>النتيجة</th>
                    <th className="text-right p-3 text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>الحالة</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((lead) => (
                    <tr key={lead.id} className="border-t cursor-pointer hover:bg-opacity-50 transition-colors" style={{ borderColor: 'rgb(var(--border))' }}
                      onClick={() => onSelectLead(lead.id)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(var(--bg-secondary))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                            {lead.name[0] ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--text-primary))' }}>{lead.name}</p>
                            <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>{lead.business ?? 'غير محدد'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {lead.normalized_phone ? (
                          <span className="text-sm font-mono" style={{ color: 'rgb(var(--text-primary))' }}>{lead.normalized_phone}</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>غير متوفر</span>
                        )}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{lead.city ?? 'غير محدد'}</td>
                      <td className="p-3">
                        <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{lead.intent.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="p-3"><ScoreBadge score={lead.score} tier={lead.score_tier} /></td>
                      <td className="p-3">
                        <span className="badge" style={{ background: 'rgb(var(--bg-secondary))', color: 'rgb(var(--text-secondary))' }}>
                          {lead.status === 'new' ? 'جديد' : lead.status === 'contacted' ? 'تم التواصل' : lead.status === 'qualified' ? 'مؤهل' : lead.status === 'disqualified' ? 'غير مؤهل' : 'محوّل'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); onSelectLead(lead.id); }} className="btn btn-ghost p-1.5">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(lead.id); }} className="btn btn-ghost p-1.5" style={{ color: 'rgb(var(--danger))' }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                صفحة {page + 1} من {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</Button>
                <Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>التالي</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Export Modal */}
      {showExport && (
        <ExportModal leads={filtered} onExport={handleExport} onClose={() => setShowExport(false)} />
      )}

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="تأكيد الحذف">
        <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>هل أنت متأكد من حذف هذا العميل؟</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
          <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>حذف</Button>
        </div>
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

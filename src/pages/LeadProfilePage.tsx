// ============================================================
// Lead Profile — detailed view with WHY THIS LEAD explanation
// ============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getLead, getLeadSources, updateLead, getCampaign } from '@/lib/services';
import type { Lead, LeadSource, Campaign } from '@/types';
import { Card, Button, Skeleton, ScoreBadge, Badge, Textarea, Select } from '@/components/ui';
import {
  ArrowRight, Phone, Mail, Globe, MapPin, Star, Building2, Calendar,
  CheckCircle2, AlertCircle, Info, FileText, Sparkles, History, Edit3,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'new', label: 'جديد' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'qualified', label: 'مؤهل' },
  { value: 'disqualified', label: 'غير مؤهل' },
  { value: 'converted', label: 'محوّل' },
];

export function LeadProfilePage({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const l = await getLead(user.id, leadId);
      setLead(l);
      if (l) {
        setNotes(l.notes ?? '');
        const [s, c] = await Promise.all([getLeadSources(l.id), getCampaign(user.id, l.campaign_id)]);
        setSources(s);
        setCampaign(c);
      }
      setLoading(false);
    })();
  }, [user, leadId]);

  const handleStatusChange = async (status: Lead['status']) => {
    if (!user || !lead) return;
    const updated = await updateLead(user.id, lead.id, { status });
    if (updated) { setLead(updated); toast('تم تحديث الحالة', 'success'); }
  };

  const handleSaveNotes = async () => {
    if (!user || !lead) return;
    const updated = await updateLead(user.id, lead.id, { notes });
    if (updated) { setLead(updated); setEditingNotes(false); toast('تم حفظ الملاحظات', 'success'); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgb(var(--text-muted))' }} />
          <p style={{ color: 'rgb(var(--text-muted))' }}>العميل غير موجود</p>
          <Button onClick={onBack} className="mt-4">العودة</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
        <ArrowRight className="w-4 h-4" />
        العودة للعملاء
      </button>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
              {lead.name[0] ?? '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{lead.name}</h1>
              {lead.business && <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{lead.business}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="info">{lead.lead_type}</Badge>
                <Badge>{lead.intent.replace(/_/g, ' ')}</Badge>
                {lead.verification_status === 'verified' && <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> موثق</Badge>}
              </div>
            </div>
          </div>
          <div className="text-left">
            <ScoreBadge score={lead.score} tier={lead.score_tier} />
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>النية: {lead.intent_score}/100</p>
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الثقة: {lead.confidence}%</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          {/* WHY THIS LEAD */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5" style={{ color: 'rgb(var(--accent))' }} />
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>لماذا هذا العميل؟</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl" style={{ background: 'rgb(var(--accent-soft))' }}>
                <p className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{lead.intent_reason}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>النية المكتشفة</p>
                  <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{lead.intent.replace(/_/g, ' ')}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>الإمكانية</p>
                  <p className="text-sm font-semibold" style={{ color: lead.potential === 'HIGH' ? 'rgb(var(--success))' : lead.potential === 'MEDIUM' ? 'rgb(var(--warning))' : 'rgb(var(--text-muted))' }}>{lead.potential}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Contacts */}
          <Card className="p-5">
            <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>معلومات الاتصال</h3>
            <div className="space-y-2">
              {lead.normalized_phone && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <Phone className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                  <span className="text-sm font-mono flex-1" style={{ color: 'rgb(var(--text-primary))' }}>{lead.normalized_phone}</span>
                  <Badge variant="success">{lead.phone_type === 'mobile' ? 'موبايل' : 'أرضي'}</Badge>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <Mail className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                  <span className="text-sm flex-1" style={{ color: 'rgb(var(--text-primary))' }}>{lead.email}</span>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <Globe className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm flex-1 hover:underline" style={{ color: 'rgb(var(--accent))' }}>{lead.website}</a>
                </div>
              )}
              {(lead.address || lead.city) && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <MapPin className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                  <span className="text-sm flex-1" style={{ color: 'rgb(var(--text-primary))' }}>{[lead.address, lead.city, lead.governorate, lead.country].filter(Boolean).join('، ')}</span>
                </div>
              )}
              {lead.maps_url && (
                <a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:opacity-80" style={{ background: 'rgb(var(--accent-soft))' }}>
                  <MapPin className="w-4 h-4" style={{ color: 'rgb(var(--accent))' }} />
                  <span className="text-sm flex-1" style={{ color: 'rgb(var(--accent))' }}>عرض على الخريطة</span>
                </a>
              )}
              {!lead.normalized_phone && !lead.email && !lead.website && (
                <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد معلومات اتصال متاحة</p>
              )}
            </div>
          </Card>

          {/* Sources */}
          <Card className="p-5">
            <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>المصادر ({sources.length})</h3>
            <div className="space-y-2">
              {sources.map((src) => (
                <div key={src.id} className="p-3 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="info">{src.source_code.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{src.date ? new Date(src.date).toLocaleDateString('ar-EG') : ''}</span>
                  </div>
                  {src.source_url && (
                    <a href={src.source_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline block mb-1" style={{ color: 'rgb(var(--accent))' }}>{src.source_url}</a>
                  )}
                  {src.context && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'rgb(var(--text-secondary))' }}>{src.context}</p>}
                </div>
              ))}
              {sources.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'rgb(var(--text-muted))' }}>لا توجد مصادر</p>}
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>ملاحظات</h3>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="btn btn-ghost p-1.5">
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أضف ملاحظاتك..." />
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => { setEditingNotes(false); setNotes(lead.notes ?? ''); }}>إلغاء</Button>
                  <Button onClick={handleSaveNotes}>حفظ</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: lead.notes ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))' }}>{lead.notes || 'لا توجد ملاحظات'}</p>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Status */}
          <Card className="p-5">
            <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>الحالة</h3>
            <Select value={lead.status} onChange={(e) => handleStatusChange(e.target.value as Lead['status'])}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Card>

          {/* Business Info */}
          <Card className="p-5">
            <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>معلومات النشاط</h3>
            <div className="space-y-2 text-sm">
              {lead.business && (
                <div className="flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                  <Building2 className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  {lead.business}
                </div>
              )}
              {lead.rating !== undefined && (
                <div className="flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                  <Star className="w-4 h-4" style={{ color: 'rgb(var(--warning))' }} />
                  {lead.rating} ({lead.reviews_count ?? 0} تقييم)
                </div>
              )}
              {campaign && (
                <div className="flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                  <FileText className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  {campaign.name}
                </div>
              )}
              <div className="flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                <Calendar className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                {new Date(lead.created_at).toLocaleDateString('ar-EG')}
              </div>
            </div>
          </Card>

          {/* Match Score */}
          {lead.match_score !== undefined && lead.match_score > 0 && (
            <Card className="p-5">
              <h3 className="font-bold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>نتيجة المطابقة</h3>
              <div className="text-center">
                <p className="text-3xl font-bold" style={{ color: 'rgb(var(--accent))' }}>{lead.match_score}%</p>
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>تطابق محتمل مع عميل آخر</p>
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
              <h3 className="font-bold" style={{ color: 'rgb(var(--text-primary))' }}>السجل</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: 'rgb(var(--success))' }} />
                <span>تم الإنشاء: {new Date(lead.created_at).toLocaleString('ar-EG')}</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: 'rgb(var(--accent))' }} />
                <span>آخر تحديث: {new Date(lead.updated_at).toLocaleString('ar-EG')}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

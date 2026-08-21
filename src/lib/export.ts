// ============================================================
// CSV Export Utility
// ============================================================

import type { Lead } from '@/types';

export type ExportField =
  | 'name' | 'business' | 'phone' | 'email' | 'website' | 'city'
  | 'governorate' | 'address' | 'score' | 'score_tier' | 'intent'
  | 'intent_score' | 'lead_type' | 'confidence' | 'potential'
  | 'verification_status' | 'status' | 'created_at';

export function exportLeadsCSV(leads: Lead[], fields: ExportField[]): void {
  const headers = fields.map((f) => f);
  const rows = leads.map((lead) => {
    return fields.map((f) => {
      let value: any;
      switch (f) {
        case 'phone': value = lead.normalized_phone ?? lead.raw_phone ?? ''; break;
        case 'score': value = lead.score; break;
        case 'score_tier': value = lead.score_tier; break;
        case 'intent': value = lead.intent; break;
        case 'intent_score': value = lead.intent_score; break;
        case 'lead_type': value = lead.lead_type; break;
        case 'confidence': value = lead.confidence; break;
        case 'potential': value = lead.potential; break;
        case 'verification_status': value = lead.verification_status; break;
        case 'status': value = lead.status; break;
        case 'created_at': value = new Date(lead.created_at).toLocaleString('ar-EG'); break;
        default: value = (lead as any)[f] ?? '';
      }
      // Escape CSV
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
  });

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

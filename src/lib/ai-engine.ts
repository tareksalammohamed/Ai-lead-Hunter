// ============================================================
// AI Engine — Intent detection, scoring, entity resolution, dedup
// All rule-based + keyword analysis (no external API needed for core logic)
// ============================================================

import type {
  Lead,
  LeadIntent,
  LeadType,
  ScoreTier,
  ScoringConfig,
  RawRecord,
} from '@/types';
import { normalizePhone } from './phone';

// ---- Intent Detection ----

const INTENT_KEYWORDS: Record<LeadIntent, string[]> = {
  FAMILY_PROTECTION: ['أولاد', 'أبناء', 'عائلة', 'أسرة', 'مستقبل', 'حماية', 'تأمين', 'حياة', 'أمن'],
  WEALTH_BUILDING: ['ادخار', 'ثروة', 'توفير', 'مصروف', 'تجميع', 'ميزانية'],
  BUSINESS_GROWTH: ['مشروع', 'تجارة', 'بزنس', 'شركة', 'مصنع', 'محل', 'استثمار', 'توسيع'],
  RETIREMENT_PLANNING: ['تقاعد', 'معاش', 'كبر', 'شيخوخة', 'بعد كبر'],
  EDUCATION_SAVING: ['تعليم', 'مدرسة', 'جامعة', 'دراسة', 'أقساط'],
  RISK_COVERAGE: ['مرض', 'حادث', 'خطر', 'تأمين صحي', 'طوارئ'],
  INVESTMENT_INTEREST: ['استثمار', 'أسهم', 'ذهب', 'عقار', 'عائد', 'ربح', 'فائدة'],
  GENERAL_FINANCIAL: ['فلوس', 'مبلغ', 'دخل', 'مال', 'يورو', 'دولار'],
  UNKNOWN: [],
};

const LEAD_TYPE_KEYWORDS: Record<LeadType, string[]> = {
  Insurance: ['تأمين', 'بوليصة', 'أقساط', 'تغطية'],
  Savings: ['ادخار', 'توفير', 'شهادة', 'إيداع'],
  Investment: ['استثمار', 'أسهم', 'ذهب', 'عقار'],
  Retirement: ['تقاعد', 'معاش', 'كبر'],
  Education: ['تعليم', 'مدرسة', 'جامعة'],
  'Family Protection': ['أولاد', 'عائلة', 'أسرة', 'حماية'],
  'Business Owner': ['مشروع', 'شركة', 'محل', 'مصنع', 'تجارة', 'بزنس'],
  Other: [],
};

export interface IntentResult {
  intent: LeadIntent;
  intent_score: number;
  reason: string;
  confidence: number;
  potential: string;
  lead_type: LeadType;
}

export function detectIntent(text: string | undefined): IntentResult {
  const content = (text ?? '').toLowerCase();
  const scores: Record<string, number> = {};
  let maxScore = 0;
  let bestIntent: LeadIntent = 'UNKNOWN';

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw.toLowerCase())) score += 1;
    }
    scores[intent] = score;
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent as LeadIntent;
    }
  }

  let bestType: LeadType = 'Other';
  let typeScore = 0;
  for (const [type, keywords] of Object.entries(LEAD_TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw.toLowerCase())) score += 1;
    }
    if (score > typeScore) {
      typeScore = score;
      bestType = type as LeadType;
    }
  }

  const intentScore = maxScore > 0 ? Math.min(100, 40 + maxScore * 20) : 0;
  const confidence = maxScore > 0 ? Math.min(100, 50 + maxScore * 15) : 0;
  const potential =
    intentScore >= 80 ? 'HIGH' : intentScore >= 50 ? 'MEDIUM' : intentScore > 0 ? 'LOW' : 'UNKNOWN';

  const reason =
    maxScore > 0
      ? `تم اكتشاف اهتمام في ${bestIntent.replace(/_/g, ' ')} بناءً على الكلمات المفتاحية`
      : 'لا يوجد محتوى كافٍ لتحديد النية';

  return {
    intent: bestIntent,
    intent_score: intentScore,
    reason,
    confidence,
    potential,
    lead_type: bestType,
  };
}

// ---- Lead Scoring ----

export interface ScoreResult {
  score: number;
  tier: ScoreTier;
  factors: { factor: string; points: number; max: number }[];
}

export function scoreLead(
  lead: Partial<Lead>,
  config: ScoringConfig,
  sourceCount: number = 1
): ScoreResult {
  const w = config.weights;
  const factors: { factor: string; points: number; max: number }[] = [];

  // Phone
  const phonePoints = lead.normalized_phone ? w.phone : 0;
  factors.push({ factor: 'رقم الهاتف', points: phonePoints, max: w.phone });

  // Intent
  const intentPoints = Math.round((lead.intent_score ?? 0) / 100 * w.intent);
  factors.push({ factor: 'النية', points: intentPoints, max: w.intent });

  // Location
  const locationPoints = lead.city || lead.governorate ? w.location : 0;
  factors.push({ factor: 'الموقع', points: locationPoints, max: w.location });

  // Business
  const businessPoints = lead.business ? w.business : 0;
  factors.push({ factor: 'النشاط', points: businessPoints, max: w.business });

  // Data completeness
  const fields = ['name', 'normalized_phone', 'email', 'city', 'business', 'website'];
  const filled = fields.filter((f) => {
    const v = lead[f as keyof Partial<Lead>];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const completenessPoints = Math.round(filled / fields.length * w.data_completeness);
  factors.push({ factor: 'اكتمال البيانات', points: completenessPoints, max: w.data_completeness });

  // Multiple sources
  const multiPoints = sourceCount > 1 ? w.multiple_sources : 0;
  factors.push({ factor: 'مصادر متعددة', points: multiPoints, max: w.multiple_sources });

  // Source quality
  const sourceQualityPoints = Math.round(w.source_quality * 0.8);
  factors.push({ factor: 'جودة المصدر', points: sourceQualityPoints, max: w.source_quality });

  // Recency
  const recencyPoints = Math.round(w.recency * 0.7);
  factors.push({ factor: 'الحداثة', points: recencyPoints, max: w.recency });

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  const t = config.thresholds;
  let tier: ScoreTier = 'LOW';
  if (score >= t.hot) tier = 'HOT';
  else if (score >= t.high) tier = 'HIGH';
  else if (score >= t.medium) tier = 'MEDIUM';

  return { score, tier, factors };
}

// ---- Entity Resolution ----

export interface MatchResult {
  match_score: number;
  match_factors: string[];
}

export function resolveEntities(a: Partial<Lead>, b: Partial<Lead>): MatchResult {
  let score = 0;
  const factors: string[] = [];

  if (a.normalized_phone && b.normalized_phone && a.normalized_phone === b.normalized_phone) {
    score += 40;
    factors.push('هاتف مطابق');
  }

  if (a.email && b.email && a.email.toLowerCase() === b.email!.toLowerCase()) {
    score += 25;
    factors.push('بريد إلكتروني مطابق');
  }

  if (a.name && b.name) {
    const similarity = stringSimilarity(a.name.toLowerCase(), b.name!.toLowerCase());
    if (similarity > 0.8) {
      score += 20;
      factors.push('اسم مشابه');
    } else if (similarity > 0.6) {
      score += 10;
      factors.push('اسم قريب');
    }
  }

  if (a.business && b.business && a.business.toLowerCase() === b.business!.toLowerCase()) {
    score += 15;
    factors.push('نشاط مطابق');
  }

  if (a.city && b.city && a.city.toLowerCase() === b.city!.toLowerCase()) {
    score += 10;
    factors.push('مدينة مطابقة');
  }

  if (a.website && b.website && a.website === b.website) {
    score += 20;
    factors.push('موقع مطابق');
  }

  return { match_score: Math.min(100, score), match_factors: factors };
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ---- Deduplication ----

export interface DedupResult {
  isDuplicate: boolean;
  rule: string;
  duplicateOfId?: string;
}

export function checkDuplicate(
  candidate: Partial<Lead>,
  existing: Lead[],
  rules: { exact_phone: boolean; exact_email: boolean; exact_website: boolean; name_business_location: boolean; fuzzy_threshold: number }
): DedupResult {
  for (const lead of existing) {
    if (rules.exact_phone && candidate.normalized_phone && lead.normalized_phone === candidate.normalized_phone) {
      return { isDuplicate: true, rule: 'exact_phone', duplicateOfId: lead.id };
    }
    if (rules.exact_email && candidate.email && lead.email && candidate.email.toLowerCase() === lead.email.toLowerCase()) {
      return { isDuplicate: true, rule: 'exact_email', duplicateOfId: lead.id };
    }
    if (rules.exact_website && candidate.website && lead.website === candidate.website) {
      return { isDuplicate: true, rule: 'exact_website', duplicateOfId: lead.id };
    }
    if (
      rules.name_business_location &&
      candidate.name && lead.name &&
      candidate.business && lead.business &&
      candidate.city && lead.city &&
      candidate.name.toLowerCase() === lead.name.toLowerCase() &&
      candidate.business.toLowerCase() === lead.business.toLowerCase() &&
      candidate.city.toLowerCase() === lead.city.toLowerCase()
    ) {
      return { isDuplicate: true, rule: 'name_business_location', duplicateOfId: lead.id };
    }
  }
  return { isDuplicate: false, rule: '' };
}

// ---- Data Extraction from raw records ----

export function extractLeadFromRaw(raw: RawRecord): Partial<Lead> {
  const d = raw.data;
  const name = String(d.name ?? d.title ?? d.business_name ?? '').trim();
  const business = String(d.business ?? d.business_name ?? d.company ?? '').trim() || undefined;
  const rawPhone = String(d.phone ?? d.telephone ?? d.mobile ?? '').trim() || undefined;
  const phoneResult = normalizePhone(rawPhone);
  const email = String(d.email ?? '').trim() || undefined;
  const website = String(d.website ?? d.url ?? '').trim() || undefined;
  const address = String(d.address ?? d.location ?? '').trim() || undefined;
  const city = String(d.city ?? d.area ?? '').trim() || undefined;
  const governorate = String(d.governorate ?? d.region ?? '').trim() || undefined;
  const rating = d.rating ? Number(d.rating) : undefined;
  const reviews_count = d.reviews_count ? Number(d.reviews_count) : undefined;
  const maps_url = String(d.maps_url ?? d.map_url ?? '').trim() || undefined;
  const content = String(d.content ?? d.description ?? d.snippet ?? d.text ?? '').trim();
  const author = String(d.author ?? d.user ?? '').trim() || undefined;
  const sourceUrl = String(d.source_url ?? d.url ?? raw.source_url ?? '').trim() || undefined;

  const intent = detectIntent(`${content} ${business ?? ''} ${name ?? ''}`);

  return {
    name: name || author || 'غير معروف',
    business,
    raw_phone: rawPhone,
    normalized_phone: phoneResult.normalized_phone ?? undefined,
    phone_type: phoneResult.phone_type,
    email,
    website,
    address,
    city,
    governorate,
    country: 'Egypt',
    rating,
    reviews_count,
    maps_url,
    social_profiles: [],
    intent: intent.intent,
    intent_score: intent.intent_score,
    intent_reason: intent.reason,
    confidence: intent.confidence,
    potential: intent.potential,
    lead_type: intent.lead_type,
    verification_status: phoneResult.valid ? 'verified' : 'unverified',
    status: 'new',
  };
}

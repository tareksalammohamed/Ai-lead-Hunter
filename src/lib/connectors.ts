// ============================================================
// Source Connectors — Plugin architecture for research sources
// ============================================================

import type { RawRecord, SourceCode, SearchQuery } from '@/types';
import { generateId } from './db';

export interface ConnectorResult {
  rawRecords: Omit<RawRecord, 'id' | 'created_at'>[];
  error?: string;
}

export interface SourceConnector {
  code: SourceCode;
  name: string;
  requiresAuth: boolean;
  search(query: SearchQuery, credentials: Record<string, string>): Promise<ConnectorResult>;
  testConnection(credentials: Record<string, string>): Promise<{ success: boolean; message: string }>;
}

// ---- Google Maps Connector ----
// Uses Google Places API if key provided; otherwise returns informative empty result
const googleMapsConnector: SourceConnector = {
  code: 'google_maps',
  name: 'Google Maps',
  requiresAuth: true,

  async search(query: SearchQuery, credentials: Record<string, string>) {
    const apiKey = credentials.api_key;
    if (!apiKey) {
      return {
        rawRecords: [],
        error: 'لم يتم تكوين مفتاح Google Places API. أضف المفتاح في إعدادات المصادر.',
      };
    }

    try {
      const searchText = query.query;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchText)}&language=ar&key=${apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return { rawRecords: [], error: `Google Places API error: ${resp.status}` };
      }
      const data = await resp.json();
      const results = (data.results ?? []) as any[];

      const rawRecords = results.map((r: any) => ({
        id: undefined as any,
        job_id: '',
        source_code: 'google_maps' as SourceCode,
        source_url: r.url ?? `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
        data: {
          name: r.name,
          business_name: r.name,
          phone: r.formatted_phone_number ?? '',
          address: r.formatted_address ?? '',
          rating: r.rating,
          reviews_count: r.user_ratings_total,
          maps_url: `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
          coordinates: r.geometry?.location,
          city: query.location ?? '',
          source_type: 'business_listing',
        },
        normalized: false,
        created_at: '',
      }));

      return { rawRecords };
    } catch (err: any) {
      return { rawRecords: [], error: err.message ?? 'فشل الاتصال بـ Google Maps' };
    }
  },

  async testConnection(credentials: Record<string, string>) {
    const apiKey = credentials.api_key;
    if (!apiKey) return { success: false, message: 'مفتاح API مطلوب' };
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${apiKey}`;
      const resp = await fetch(url);
      if (resp.ok) return { success: true, message: 'تم الاتصال بنجاح' };
      return { success: false, message: `فشل الاتصال (${resp.status})` };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'فشل الاتصال' };
    }
  },
};

// ---- Web Search Connector ----
// Uses a search API (e.g. SerpAPI, Google Custom Search, or Tavily) if key provided
const webSearchConnector: SourceConnector = {
  code: 'web_search',
  name: 'Web Search',
  requiresAuth: true,

  async search(query: SearchQuery, credentials: Record<string, string>) {
    const apiKey = credentials.api_key;
    if (!apiKey) {
      return {
        rawRecords: [],
        error: 'لم يتم تكوين مفتاح Search API. أضف المفتاح في إعدادات المصادر.',
      };
    }

    try {
      const searchUrl = `https://api.tavily.com/search?q=${encodeURIComponent(query.query)}&api_key=${apiKey}&max_results=10`;
      const resp = await fetch(searchUrl);
      if (!resp.ok) {
        return { rawRecords: [], error: `Search API error: ${resp.status}` };
      }
      const data = await resp.json();
      const results = (data.results ?? []) as any[];

      const rawRecords = results.map((r: any) => ({
        id: undefined as any,
        job_id: '',
        source_code: 'web_search' as SourceCode,
        source_url: r.url ?? '',
        data: {
          name: r.title ?? '',
          content: r.content ?? '',
          snippet: r.content ?? '',
          source_url: r.url ?? '',
          city: query.location ?? '',
          source_type: 'web_result',
        },
        normalized: false,
        created_at: '',
      }));

      return { rawRecords };
    } catch (err: any) {
      return { rawRecords: [], error: err.message ?? 'فشل البحث' };
    }
  },

  async testConnection(credentials: Record<string, string>) {
    const apiKey = credentials.api_key;
    if (!apiKey) return { success: false, message: 'مفتاح API مطلوب' };
    return { success: true, message: 'تم حفظ المفتاح. سيتم اختباره عند البحث.' };
  },
};

// ---- Facebook Connector ----
// Requires Facebook OAuth / Page access token
const facebookConnector: SourceConnector = {
  code: 'facebook',
  name: 'Facebook',
  requiresAuth: true,

  async search(query: SearchQuery, credentials: Record<string, string>) {
    const accessToken = credentials.access_token ?? credentials.api_key;
    if (!accessToken) {
      return {
        rawRecords: [],
        error: 'لم يتم تكوين Facebook Access Token. أضف الرمز في إعدادات المصادر.',
      };
    }

    try {
      const url = `https://graph.facebook.com/v18.0/search?q=${encodeURIComponent(query.query)}&type=page&fields=name,about,phone,website,location,link&access_token=${accessToken}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return { rawRecords: [], error: `Facebook API error: ${resp.status}` };
      }
      const data = await resp.json();
      const results = (data.data ?? []) as any[];

      const rawRecords = results.map((r: any) => ({
        id: undefined as any,
        job_id: '',
        source_code: 'facebook' as SourceCode,
        source_url: r.link ?? `https://facebook.com/${r.id}`,
        data: {
          name: r.name ?? '',
          phone: r.phone ?? '',
          website: r.website ?? '',
          city: r.location?.city ?? query.location ?? '',
          content: r.about ?? '',
          author: r.name ?? '',
          source_url: r.link ?? '',
          source_type: 'facebook_page',
        },
        normalized: false,
        created_at: '',
      }));

      return { rawRecords };
    } catch (err: any) {
      return { rawRecords: [], error: err.message ?? 'فشل الاتصال بـ Facebook' };
    }
  },

  async testConnection(credentials: Record<string, string>) {
    const token = credentials.access_token ?? credentials.api_key;
    if (!token) return { success: false, message: 'Access Token مطلوب' };
    try {
      const url = `https://graph.facebook.com/v18.0/me?access_token=${token}`;
      const resp = await fetch(url);
      if (resp.ok) return { success: true, message: 'تم الاتصال بنجاح' };
      return { success: false, message: `فشل الاتصال (${resp.status})` };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'فشل الاتصال' };
    }
  },
};

// ---- LinkedIn Connector ----
// Requires LinkedIn API credentials
const linkedinConnector: SourceConnector = {
  code: 'linkedin',
  name: 'LinkedIn',
  requiresAuth: true,

  async search(_query: SearchQuery, credentials: Record<string, string>) {
    const token = credentials.access_token ?? credentials.api_key;
    if (!token) {
      return {
        rawRecords: [],
        error: 'لم يتم تكوين LinkedIn Access Token. أضف الرمز في إعدادات المصادر.',
      };
    }
    return {
      rawRecords: [],
      error: 'LinkedIn API يتطلب موافقة LinkedIn Partner. هذا الموصل جاهز للتكامل عند توفر الموافقة.',
    };
  },

  async testConnection(credentials: Record<string, string>) {
    const token = credentials.access_token ?? credentials.api_key;
    if (!token) return { success: false, message: 'Access Token مطلوب' };
    return { success: true, message: 'تم حفظ الرمز. يتطلب LinkedIn API موافقة Partner.' };
  },
};

// ---- Website Connector ----
// Direct URL content extraction
const websiteConnector: SourceConnector = {
  code: 'website',
  name: 'Website',
  requiresAuth: false,

  async search(query: SearchQuery, _credentials: Record<string, string>) {
    const url = query.query;
    if (!url || !url.startsWith('http')) {
      return { rawRecords: [], error: 'يجب إدخال رابط موقع صحي' };
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) return { rawRecords: [], error: `فشل تحميل الموقع (${resp.status})` };
      const html = await resp.text();
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : url;

      return {
        rawRecords: [
          {
            id: undefined as any,
            job_id: '',
            source_code: 'website' as SourceCode,
            source_url: url,
            data: {
              name: title,
              content: text.slice(0, 5000),
              source_url: url,
              source_type: 'website_content',
            },
            normalized: false,
            created_at: '',
          },
        ],
      };
    } catch (err: any) {
      return { rawRecords: [], error: err.message ?? 'فشل استخراج محتوى الموقع' };
    }
  },

  async testConnection() {
    return { success: true, message: 'لا يتطلب تكوين' };
  },
};

export const connectors: Record<SourceCode, SourceConnector> = {
  google_maps: googleMapsConnector,
  web_search: webSearchConnector,
  facebook: facebookConnector,
  linkedin: linkedinConnector,
  website: websiteConnector,
};

export function getConnector(code: SourceCode): SourceConnector | undefined {
  return connectors[code];
}

export function generateSearchQueries(
  keywords: string[],
  locations: string[],
  sources: SourceCode[]
): SearchQuery[] {
  const queries: SearchQuery[] = [];
  for (const source of sources) {
    for (const keyword of keywords) {
      for (const location of locations.length > 0 ? locations : ['']) {
        const q = location ? `${keyword} ${location}` : keyword;
        queries.push({
          id: generateId(),
          source,
          query: q,
          location: location || undefined,
        });
      }
    }
  }
  return queries;
}

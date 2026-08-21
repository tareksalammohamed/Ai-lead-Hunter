// Data access layer — Supabase first, IndexedDB fallback
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';

const DB_NAME = 'ai-lead-hunter';
const DB_VERSION = 3;

export const STORES = [
  'profiles', 'campaigns', 'sources', 'source_connections', 'ai_providers', 'system_settings',
  'research_jobs', 'research_job_steps', 'search_queries', 'raw_records', 'leads', 'lead_contacts',
  'lead_sources', 'lead_scores', 'lead_intents', 'lead_matches', 'lead_duplicates', 'ai_runs',
  'audit_logs', 'admin_users', 'admin_roles', 'admin_config', 'admin_config_changes',
  'admin_ai_providers', 'admin_ai_model_router', 'admin_search_providers', 'admin_source_connectors',
  'admin_research_engine', 'admin_scoring', 'admin_intent_categories', 'admin_phone_rules',
  'admin_duplicate_engine', 'admin_feature_flags', 'admin_health_checks', 'admin_security_events',
  'admin_notifications', 'admin_maintenance',
] as const;

export type StoreName = (typeof STORES)[number];

type Row = Record<string, unknown>;

const KEY_FIELDS: Partial<Record<StoreName, string>> = {
  admin_config: 'key',
  admin_ai_model_router: 'task',
  admin_source_connectors: 'code',
  admin_notifications: 'key',
};

function keyField(store: StoreName): string {
  return KEY_FIELDS[store] ?? 'id';
}

function keyValue(store: StoreName, value: Row): string {
  const field = keyField(store);
  const key = value[field];
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`السجل في ${store} يحتاج إلى المفتاح ${field}`);
  }
  return key;
}

let dbInstance: IDBDatabase | null = null;

function openLocalDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const store of STORES) {
        const expectedKey = keyField(store);
        if (db.objectStoreNames.contains(store)) {
          const existing = (e.target as IDBOpenDBRequest).transaction?.objectStore(store);
          if (existing && existing.keyPath !== expectedKey) {
            db.deleteObjectStore(store);
          }
        }
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: expectedKey });
        }
      }
    };
  });
}

function assertSupabase() {
  if (!supabase || !isSupabaseConfigured) throw new Error('Supabase غير مهيأ');
  return supabase;
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await assertSupabase().from(store).select('*');
    if (error) throw error;
    return (data ?? []) as T[];
  }
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<T>(store: StoreName, id: string): Promise<T | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await assertSupabase().from(store).select('*').eq(keyField(store), id).maybeSingle();
    if (error) throw error;
    return (data as T | null) ?? null;
  }
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(id);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<T>(store: StoreName, value: T): Promise<T> {
  const row = value as unknown as Row;
  if (isSupabaseConfigured && supabase) {
    keyValue(store, row);
    const { data, error } = await assertSupabase().from(store).upsert(row, { onConflict: keyField(store) }).select().single();
    if (error) throw error;
    return (data as T) ?? value;
  }
  const db = await openLocalDB();
  keyValue(store, row);
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(store: StoreName, id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await assertSupabase().from(store).delete().eq(keyField(store), id);
    if (error) throw error;
    return;
  }
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClear(store: StoreName): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const field = keyField(store);
    const { error } = await assertSupabase().from(store).delete().not(field, 'is', null);
    if (error) throw error;
    return;
  }
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbBulkPut<T>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return;
  if (isSupabaseConfigured && supabase) {
    values.forEach((value) => keyValue(store, value as unknown as Row));
    const { error } = await assertSupabase().from(store).upsert(values as Row[], { onConflict: keyField(store) });
    if (error) throw error;
    return;
  }
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const value of values) { keyValue(store, value as unknown as Row); os.put(value); }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function generateId(): string { return crypto.randomUUID(); }
export function nowISO(): string { return new Date().toISOString(); }

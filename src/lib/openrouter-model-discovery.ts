import type { AIModelHealth, OpenRouterModel } from '@/types';
import { dbGetAll } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

export interface DiscoveryResult { count: number; free_models: number; models: OpenRouterModel[]; refreshed_at: string; }

export async function refreshOpenRouterModelPool(): Promise<DiscoveryResult> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase غير مهيأ لاكتشاف النماذج');
  const { data, error } = await supabase.functions.invoke('openrouter-model-discovery', { body: {} });
  if (error) throw error;
  return data as DiscoveryResult;
}

export async function getFreeModelPool(): Promise<AIModelHealth[]> {
  const models = await dbGetAll<AIModelHealth>('ai_model_health');
  return models.filter((model) => model.is_free && model.status === 'ACTIVE' && (!model.cooldown_until || model.cooldown_until < new Date().toISOString()));
}

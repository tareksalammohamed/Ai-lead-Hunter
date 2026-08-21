export type AdapterInput = {
  candidate: { provider: string; model: string; fallbackModels?: string[] };
  payload: Record<string, unknown>;
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
};

export type AdapterResult = {
  content: string;
  structured?: Record<string, unknown>;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  provider: string;
  model: string;
};

export type AdapterInvoker = (input: AdapterInput) => Promise<AdapterResult>;

export interface ProviderAdapter {
  generate(input: AdapterInput): Promise<AdapterResult>;
  generateStructured(input: AdapterInput): Promise<AdapterResult>;
  stream(input: AdapterInput): Promise<AdapterResult>;
  healthCheck(input: AdapterInput): Promise<{ success: boolean; latency_ms: number; error?: string }>;
}

abstract class BaseAdapter implements ProviderAdapter {
  constructor(protected readonly invoke: AdapterInvoker) {}
  generate(input: AdapterInput) { return this.invoke(input); }
  generateStructured(input: AdapterInput) { return this.invoke({ ...input, payload: { ...input.payload, structured_schema: input.payload.structured_schema } }); }
  stream(input: AdapterInput) { return this.invoke(input); }
  async healthCheck(input: AdapterInput) {
    const started = Date.now();
    try { await this.invoke({ ...input, messages: [{ role: 'user', content: 'health check' }], payload: { ...input.payload, max_tokens: 8 } }); return { success: true, latency_ms: Date.now() - started }; }
    catch (error) { return { success: false, latency_ms: Date.now() - started, error: String(error) }; }
  }
}

export class OpenRouterAdapter extends BaseAdapter {}
export class OpenAIAdapter extends BaseAdapter {}
export class GeminiAdapter extends BaseAdapter {}
export class AnthropicAdapter extends BaseAdapter {}
export class HuggingFaceAdapter extends BaseAdapter {}

export function createProviderAdapter(provider: string, invoke: AdapterInvoker): ProviderAdapter {
  switch (provider) {
    case 'openrouter': return new OpenRouterAdapter(invoke);
    case 'openai': return new OpenAIAdapter(invoke);
    case 'gemini': return new GeminiAdapter(invoke);
    case 'anthropic': return new AnthropicAdapter(invoke);
    case 'huggingface': return new HuggingFaceAdapter(invoke);
    default: return new OpenRouterAdapter(invoke);
  }
}

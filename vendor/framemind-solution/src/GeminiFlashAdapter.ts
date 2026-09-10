import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './types.js';

export type GeminiFetch = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface GeminiFlashAdapterOptions {
  /** Server-side only. Never put this value into a browser bundle. */
  apiKey: string;
  endpoint?: string;
  model?: string;
  fetcher?: GeminiFetch;
}

function outputText(value: unknown): string | null {
  const steps = (value as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps)) return null;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const parts = (steps[i] as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const text = (part as { text?: unknown } | undefined)?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  return null;
}

/** Server-only, stateless fallback. No remote state, tools, grounding or files. */
export class GeminiFlashAdapter implements ProviderAdapter {
  readonly id = 'google-gemini-3.8-flash';
  readonly enabled: boolean;
  private readonly key: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetcher: GeminiFetch;

  constructor(options: GeminiFlashAdapterOptions) {
    this.key = options.apiKey.trim();
    this.enabled = Boolean(this.key);
    this.endpoint = (options.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.model = options.model || 'gemini-3.8-flash';
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.enabled) throw new Error('Gemini adapter is not configured');
    const context = Object.entries(request.context.slots).map(([key, value]) => key + ': ' + value).join('\n');
    const prompt = [
      'You are a concise FrameMind fallback. Use only the supplied question and approved context. Do not request personal data, invoke tools or invent facts.',
      'Locale: ' + request.locale,
      context ? 'Approved context:\n' + context : '',
      'Question:\n' + request.text,
    ].filter(Boolean).join('\n\n');
    const response = await this.fetcher(this.endpoint + '/interactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [{ type: 'user_input', content: [{ type: 'text', text: prompt }] }],
        generation_config: { thinking_level: 'low', max_output_tokens: 800 },
      }),
    });
    if (!response.ok) throw new Error('Gemini request failed with ' + response.status);
    const text = outputText(await response.json());
    if (!text) throw new Error('Gemini returned no text');
    return { text, providerId: this.id };
  }
}
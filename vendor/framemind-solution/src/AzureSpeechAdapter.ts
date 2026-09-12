import type { DataPolicy } from './DataPolicy.js';
import type {
  SpeechToTextProvider,
  SpeechToTextRequest,
  SpeechToTextResponse,
  TenantDeploymentPolicy,
  TextToSpeechProvider,
  TextToSpeechRequest,
  TextToSpeechResponse,
} from './types.js';

export type AzureSpeechFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface AzureSpeechAdapterOptions {
  /** Server-side only. Never expose this key in a browser bundle. */
  apiKey: string;
  /** Runtime configuration. Must exactly match the Speech resource region. */
  region: string;
  voiceByLocale?: Record<string, string>;
  fetcher?: AzureSpeechFetch;
  dataPolicy?: DataPolicy;
  tenantPolicy?: TenantDeploymentPolicy;
}

export interface AzureSpeechAuthorizationToken {
  token: string;
  region: string;
  expiresInSeconds: 600;
}

/** Stateless server adapter. Browser audio should go directly to Azure with an issued short-lived token. */
export class AzureSpeechAdapter implements SpeechToTextProvider, TextToSpeechProvider {
  readonly id = 'azure-speech';
  readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly region: string;
  private readonly voiceByLocale: Record<string, string>;
  private readonly fetcher: AzureSpeechFetch;
  private readonly dataPolicy: DataPolicy | undefined;
  private readonly tenantPolicy: TenantDeploymentPolicy | undefined;

  constructor(options: AzureSpeechAdapterOptions) {
    this.apiKey = options.apiKey.trim();
    this.region = options.region.trim().toLowerCase();
    this.enabled = Boolean(this.apiKey && this.region);
    this.voiceByLocale = {
      'cs-CZ': 'cs-CZ-VlastaNeural',
      'en-US': 'en-US-JennyNeural',
      'en-GB': 'en-GB-SoniaNeural',
      ...(options.voiceByLocale ?? {}),
    };
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
    this.dataPolicy = options.dataPolicy;
    this.tenantPolicy = options.tenantPolicy;
  }

  async issueAuthorizationToken(signal?: AbortSignal, voiceActivated = true): Promise<AzureSpeechAuthorizationToken> {
    this.assertConfigured();
    if (this.dataPolicy && this.tenantPolicy) {
      const auth = this.dataPolicy.authorizeEgress({
        tenantId: this.tenantPolicy.tenantId,
        audience: this.tenantPolicy.audience,
        provider: this.id,
        purpose: 'speech-to-text',
        dataClass: 'visitor-content',
        processingMode: this.tenantPolicy.processingMode,
        region: this.region,
        voiceActivated,
      });
      if (!auth.allowed) throw new Error('Azure Speech token egress denied: ' + auth.reason);
    }
    const response = await this.fetcher('https://' + this.region + '.api.cognitive.microsoft.com/sts/v1.0/issueToken', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': '0',
      },
      ...(signal ? { signal } : {}),
    });
    const token = (await response.text()).trim();
    if (!response.ok || !token) throw new Error('Azure Speech token request failed with ' + response.status);
    return { token, region: this.region, expiresInSeconds: 600 };
  }

  async transcribe(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
    this.assertConfigured();
    if (this.dataPolicy && this.tenantPolicy) {
      const auth = this.dataPolicy.authorizeEgress({
        tenantId: this.tenantPolicy.tenantId,
        audience: this.tenantPolicy.audience,
        provider: this.id,
        purpose: 'speech-to-text',
        dataClass: 'visitor-content',
        processingMode: this.tenantPolicy.processingMode,
        region: this.region,
        voiceActivated: true,
      });
      if (!auth.allowed) throw new Error('Azure Speech transcribe egress denied: ' + auth.reason);
    }
    const response = await this.fetcher('https://' + this.region + '.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=' + encodeURIComponent(request.locale), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'content-type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      },
      body: request.audio,
      ...(request.signal ? { signal: request.signal } : {}),
    });
    const payload = await response.json() as { DisplayText?: unknown };
    const text = typeof payload.DisplayText === 'string' ? payload.DisplayText.trim() : '';
    if (!response.ok || !text) throw new Error('Azure Speech transcription failed with ' + response.status);
    return { text, providerId: this.id, locale: request.locale };
  }

  async synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResponse> {
    this.assertConfigured();
    if (this.dataPolicy && this.tenantPolicy) {
      const auth = this.dataPolicy.authorizeEgress({
        tenantId: this.tenantPolicy.tenantId,
        audience: this.tenantPolicy.audience,
        provider: this.id,
        purpose: 'text-to-speech',
        dataClass: 'public-data',
        processingMode: this.tenantPolicy.processingMode,
        region: this.region,
        voiceActivated: true,
      });
      if (!auth.allowed) throw new Error('Azure Speech synthesize egress denied: ' + auth.reason);
    }
    const voice = request.voice ?? resolveVoice(this.voiceByLocale, request.locale);
    if (!voice) throw new Error('Azure Speech voice is not configured for ' + request.locale);
    const text = String(request.text ?? '').trim().slice(0, 4000);
    if (!text) throw new Error('Azure Speech synthesis requires text');
    const ssml = '<speak version="1.0" xml:lang="' + escapeXml(request.locale) + '"><voice name="' + escapeXml(voice) + '">' + escapeXml(text) + '</voice></speak>';
    const response = await this.fetcher('https://' + this.region + '.tts.speech.microsoft.com/cognitiveservices/v1', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'content-type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'framemind-solution',
      },
      body: ssml,
      ...(request.signal ? { signal: request.signal } : {}),
    });
    if (!response.ok) throw new Error('Azure Speech synthesis failed with ' + response.status);
    return {
      audio: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || 'audio/mpeg',
      providerId: this.id,
      voice,
    };
  }

  private assertConfigured(): void {
    if (!this.enabled) throw new Error('Azure Speech adapter is not configured');
  }
}

function resolveVoice(mapping: Record<string, string>, locale: string): string | undefined {
  if (mapping[locale]) return mapping[locale];
  const prefix = locale.split('-')[0]?.toLowerCase();
  if (prefix && mapping[prefix + '-*']) return mapping[prefix + '-*'];
  if (prefix === 'cs') return mapping['cs-CZ'];
  if (prefix === 'en') return mapping['en-US'] || mapping['en-GB'];
  return undefined;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char);
}

import type {
  LocalSpeechRecognitionCapability,
  LocalVoiceCapability,
  SpeechRecognitionLike,
  SpeechSynthesisVoiceLike,
} from './types.js';

type RecognitionConstructor = {
  new(): SpeechRecognitionLike;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
};

export class VoiceCapability {
  async localSpeechRecognition(scope: Record<string, any> = globalThis as Record<string, any>, language = 'cs-CZ'): Promise<LocalSpeechRecognitionCapability> {
    const win = scope.window ?? scope;
    const Recognition = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as RecognitionConstructor | undefined;
    if (!Recognition) return { available: false, reason: 'api-missing' };
    if (typeof Recognition.available !== 'function') return { available: false, reason: 'availability-unknown' };
    let status: string;
    try {
      status = await Recognition.available({ langs: [language], processLocally: true });
    } catch {
      return { available: false, reason: 'check-failed' };
    }
    if (status !== 'available') return { available: false, reason: 'language-missing' };
    return {
      available: true,
      reason: 'available',
      create: () => {
        const recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.processLocally = true;
        return recognition;
      },
    };
  }

  localTts(scope: Record<string, any> = globalThis as Record<string, any>, language = 'cs-CZ'): LocalVoiceCapability {
    const synth = scope.speechSynthesis ?? scope.window?.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return { available: false, reason: 'api-missing' };
    const voices = synth.getVoices() as SpeechSynthesisVoiceLike[];
    if (!voices.length) return { available: false, reason: 'voices-pending' };
    const prefix = language.toLowerCase().split('-')[0] ?? language.toLowerCase();
    const voice = voices.find((candidate) => candidate.localService === true && candidate.lang?.toLowerCase().startsWith(prefix));
    if (!voice) return { available: false, reason: 'local-language-missing' };
    return { available: true, reason: 'available', voice };
  }
}

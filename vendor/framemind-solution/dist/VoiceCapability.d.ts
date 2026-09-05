import type { LocalSpeechRecognitionCapability, LocalVoiceCapability } from './types.js';
export declare class VoiceCapability {
    localSpeechRecognition(scope?: Record<string, any>, language?: string): Promise<LocalSpeechRecognitionCapability>;
    localTts(scope?: Record<string, any>, language?: string): LocalVoiceCapability;
}
//# sourceMappingURL=VoiceCapability.d.ts.map
import type { LanguageCode, VoiceId } from '@aws-sdk/client-polly';

export interface SynthesizeRequest {
  text: string;
  voiceId: VoiceId;
  languageCode?: LanguageCode;
  engine?: 'neural' | 'standard' | 'long-form' | 'generative';
}

export interface SynthesizedSpeech {
  audio: Uint8Array;
  /** Newline-delimited JSON speech marks (sentence and word). */
  speechMarks: string;
  durationS: number;
}

/** A voice that can read a narration, as Amazon Polly describes it. */
export interface SpeechVoice {
  /** Polly voice id, e.g. `Andres`. */
  id: string;
  /** Display name, e.g. `Andrés`. */
  name: string;
  gender: 'female' | 'male';
  /** BCP 47 code of the main language, e.g. `es-MX`. */
  languageCode: string;
}

/** Text-to-speech contract. Polly in AWS; unavailable in the sandbox. */
export interface SpeechSynthesizer {
  synthesize(request: SynthesizeRequest): Promise<SynthesizedSpeech>;
  /** Voices of the engine used for synthesis. */
  voices(): Promise<readonly SpeechVoice[]>;
}

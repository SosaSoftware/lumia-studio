import { AppError } from '../../src/shared/errors/index.ts';
import type { SpeechSynthesizer, SpeechVoice, SynthesizedSpeech } from '../../src/infrastructure/speech/index.ts';

/** Polly stand-in for tests: lists a few voices and fails synthesis with the sandbox message. */
export class FakeSpeechSynthesizer implements SpeechSynthesizer {
  public static readonly VOICES: readonly SpeechVoice[] = [
    { id: 'Lupe', name: 'Lupe', gender: 'female', languageCode: 'es-US' },
    { id: 'Mia', name: 'Mia', gender: 'female', languageCode: 'es-MX' },
    { id: 'Andres', name: 'Andrés', gender: 'male', languageCode: 'es-MX' },
  ];

  public synthesize(): Promise<SynthesizedSpeech> {
    return Promise.reject(new AppError('ValidationError', 'La narración no está disponible en el sandbox'));
  }

  public voices(): Promise<readonly SpeechVoice[]> {
    return Promise.resolve(FakeSpeechSynthesizer.VOICES);
  }
}

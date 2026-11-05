import { AppError } from '../../shared/errors/index.ts';
import type { SpeechVoice, SynthesizedSpeech, SpeechSynthesizer } from './speech-synthesizer.ts';

/** Sandbox synthesizer: Polly is not reachable, so there is no voice to list and synthesis fails (the clip stays `failed`). */
export class UnavailableSpeechSynthesizer implements SpeechSynthesizer {
  public synthesize(): Promise<SynthesizedSpeech> {
    return Promise.reject(new AppError('ValidationError', 'La narración no está disponible en el sandbox'));
  }

  public voices(): Promise<readonly SpeechVoice[]> {
    return Promise.reject(new AppError('InternalError', 'Polly no está disponible en el sandbox: no hay voces para elegir.'));
  }
}

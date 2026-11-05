import { PollyClient } from '@aws-sdk/client-polly';
import type { Config } from '../../shared/config/index.ts';
import { ConfigError } from '../../shared/config/index.ts';
import { PollySpeechSynthesizer } from './polly-speech-synthesizer.ts';
import type { SpeechSynthesizer } from './speech-synthesizer.ts';
import { UnavailableSpeechSynthesizer } from './unavailable-speech-synthesizer.ts';

/** Builds the synthesizer selected by `LUMIA_SPEECH_PROVIDER` (`polly` or `none`). */
export function createSpeechSynthesizer(config: Config): SpeechSynthesizer {
  const provider = config.optional('LUMIA_SPEECH_PROVIDER', 'none');
  if (provider === 'polly') {
    return new PollySpeechSynthesizer(new PollyClient({}));
  }
  if (provider === 'none') {
    return new UnavailableSpeechSynthesizer();
  }
  throw new ConfigError('LUMIA_SPEECH_PROVIDER', `"${provider}" is not supported; use "polly" or "none"`);
}

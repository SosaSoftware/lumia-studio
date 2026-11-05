import { DescribeVoicesCommand, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import type { PollyClient, Voice } from '@aws-sdk/client-polly';
import { AppError } from '../../shared/errors/index.ts';
import type { SpeechVoice, SynthesizedSpeech, SynthesizeRequest, SpeechSynthesizer } from './speech-synthesizer.ts';

/** Engine used when the request names none; the voice list is the one of this engine. */
const DEFAULT_ENGINE = 'neural';

/** Synthesizes with Amazon Polly: one call for the MP3 and one for the speech marks. */
export class PollySpeechSynthesizer implements SpeechSynthesizer {
  private voiceList: Promise<readonly SpeechVoice[]> | null = null;

  public constructor(private readonly client: PollyClient) {}

  public async synthesize(request: SynthesizeRequest): Promise<SynthesizedSpeech> {
    const base = {
      Text: request.text,
      VoiceId: request.voiceId,
      Engine: request.engine ?? DEFAULT_ENGINE,
      ...(request.languageCode === undefined ? {} : { LanguageCode: request.languageCode }),
    };
    const audioResponse = await this.client.send(
      new SynthesizeSpeechCommand({ ...base, OutputFormat: 'mp3' }),
    );
    const marksResponse = await this.client.send(
      new SynthesizeSpeechCommand({ ...base, OutputFormat: 'json', SpeechMarkTypes: ['sentence', 'word'] }),
    );
    if (audioResponse.AudioStream === undefined || marksResponse.AudioStream === undefined) {
      throw AppError.internal('Polly no devolvió audio.');
    }
    const audio = await audioResponse.AudioStream.transformToByteArray();
    const speechMarks = await marksResponse.AudioStream.transformToString();
    return { audio, speechMarks, durationS: PollySpeechSynthesizer.durationFrom(speechMarks) };
  }

  /** Voices of the default engine. The list rarely changes, so it is read once; a failed read is retried next time. */
  public voices(): Promise<readonly SpeechVoice[]> {
    this.voiceList ??= this.describeVoices().catch((error: unknown) => {
      this.voiceList = null;
      throw error;
    });
    return this.voiceList;
  }

  private async describeVoices(): Promise<readonly SpeechVoice[]> {
    const found: SpeechVoice[] = [];
    let nextToken: string | undefined;
    do {
      const response = await this.client.send(new DescribeVoicesCommand({ Engine: DEFAULT_ENGINE, ...(nextToken === undefined ? {} : { NextToken: nextToken }) }));
      for (const voice of response.Voices ?? []) {
        const mapped = PollySpeechSynthesizer.toVoice(voice);
        if (mapped !== null) {
          found.push(mapped);
        }
      }
      nextToken = response.NextToken;
    } while (nextToken !== undefined && nextToken !== '');
    return found;
  }

  private static toVoice(voice: Voice): SpeechVoice | null {
    if (voice.Id === undefined || voice.LanguageCode === undefined) {
      return null;
    }
    return { id: voice.Id, name: voice.Name ?? voice.Id, gender: voice.Gender === 'Male' ? 'male' : 'female', languageCode: voice.LanguageCode };
  }

  /** The last mark starts at `time` ms; the clip ends at that mark's start (best available estimate). */
  private static durationFrom(speechMarks: string): number {
    let last = 0;
    for (const line of speechMarks.split('\n')) {
      if (line.trim() === '') {
        continue;
      }
      const mark: unknown = JSON.parse(line);
      if (typeof mark === 'object' && mark !== null && 'time' in mark && typeof mark.time === 'number') {
        last = Math.max(last, mark.time);
      }
    }
    return last / 1000;
  }
}

import type { DescribeVoicesCommand, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import type { PollyClient } from '@aws-sdk/client-polly';
import { describe, expect, it, vi } from 'vitest';
import { Config } from '../../shared/config/index.ts';
import { PollySpeechSynthesizer } from './polly-speech-synthesizer.ts';
import { createSpeechSynthesizer } from './speech-synthesizer-factory.ts';
import { UnavailableSpeechSynthesizer } from './unavailable-speech-synthesizer.ts';

const MARKS = [
  '{"time":0,"type":"sentence","start":0,"end":9,"value":"Hola mundo"}',
  '{"time":0,"type":"word","start":0,"end":4,"value":"Hola"}',
  '{"time":1500,"type":"word","start":5,"end":9,"value":"mundo"}',
].join('\n');

describe('PollySpeechSynthesizer', () => {
  it('makes an MP3 call and a speech marks call and derives the duration', async () => {
    const send = vi.fn((command: SynthesizeSpeechCommand) =>
      Promise.resolve(
        command.input.OutputFormat === 'mp3'
          ? { AudioStream: { transformToByteArray: () => Promise.resolve(new Uint8Array([9, 9])) } }
          : { AudioStream: { transformToString: () => Promise.resolve(MARKS) } },
      ),
    );
    const result = await new PollySpeechSynthesizer({ send } as unknown as PollyClient).synthesize({
      text: 'Hola mundo', voiceId: 'Lupe', languageCode: 'es-US',
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({ OutputFormat: 'mp3', VoiceId: 'Lupe', Text: 'Hola mundo' });
    expect(send.mock.calls[1]?.[0].input).toMatchObject({ OutputFormat: 'json', SpeechMarkTypes: ['sentence', 'word'] });
    expect(result).toEqual({ audio: new Uint8Array([9, 9]), speechMarks: MARKS, durationS: 1.5 });
  });

  it('lists the voices of the neural engine across pages and reads them once', async () => {
    const send = vi.fn((command: DescribeVoicesCommand) =>
      Promise.resolve(
        command.input.NextToken === undefined
          ? { Voices: [{ Id: 'Andres', Name: 'Andrés', Gender: 'Male', LanguageCode: 'es-MX' }], NextToken: 'p2' }
          : { Voices: [{ Id: 'Lupe', Name: 'Lupe', Gender: 'Female', LanguageCode: 'es-US' }, { Name: 'sin id' }] },
      ),
    );
    const polly = new PollySpeechSynthesizer({ send } as unknown as PollyClient);
    const voices = await polly.voices();
    expect(voices).toEqual([
      { id: 'Andres', name: 'Andrés', gender: 'male', languageCode: 'es-MX' },
      { id: 'Lupe', name: 'Lupe', gender: 'female', languageCode: 'es-US' },
    ]);
    expect(send.mock.calls.map((call) => call[0].input)).toEqual([{ Engine: 'neural' }, { Engine: 'neural', NextToken: 'p2' }]);
    await polly.voices();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries the voice list after a failure', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('throttled')).mockResolvedValue({ Voices: [] });
    const polly = new PollySpeechSynthesizer({ send } as unknown as PollyClient);
    await expect(polly.voices()).rejects.toThrow('throttled');
    await expect(polly.voices()).resolves.toEqual([]);
  });

  it('fails when Polly returns no stream', async () => {
    const send = vi.fn(() => Promise.resolve({}));
    await expect(new PollySpeechSynthesizer({ send } as unknown as PollyClient).synthesize({ text: 'a', voiceId: 'Lupe' }))
      .rejects.toMatchObject({ errorType: 'InternalError' });
  });
});

describe('UnavailableSpeechSynthesizer and factory', () => {
  it('always fails with the sandbox message', async () => {
    await expect(new UnavailableSpeechSynthesizer().synthesize()).rejects.toMatchObject({
      errorType: 'ValidationError', message: 'La narración no está disponible en el sandbox',
    });
  });

  it('has no voices to list, because Polly is not reachable', async () => {
    await expect(new UnavailableSpeechSynthesizer().voices()).rejects.toMatchObject({
      errorType: 'InternalError', message: 'Polly no está disponible en el sandbox: no hay voces para elegir.',
    });
  });

  it('selects by provider', () => {
    const make = (value?: string): Config => new Config({ get: (n) => (n === 'LUMIA_SPEECH_PROVIDER' ? value : undefined) });
    expect(createSpeechSynthesizer(make('none'))).toBeInstanceOf(UnavailableSpeechSynthesizer);
    expect(createSpeechSynthesizer(make())).toBeInstanceOf(UnavailableSpeechSynthesizer);
    expect(createSpeechSynthesizer(make('polly'))).toBeInstanceOf(PollySpeechSynthesizer);
    expect(() => createSpeechSynthesizer(make('x'))).toThrow();
  });
});

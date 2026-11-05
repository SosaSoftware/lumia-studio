import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/graphql-client.ts';
import type { Voice } from '../../api/types.ts';
import { languageLabel, voiceChoices, VoiceStore } from './voice-store.ts';

const VOICES: Voice[] = [
  { id: 'Lupe', name: 'Lupe', gender: 'female', languageCode: 'es-US' },
  { id: 'Andres', name: 'Andrés', gender: 'male', languageCode: 'es-MX' },
  { id: 'Mia', name: 'Mia', gender: 'female', languageCode: 'es-MX' },
  { id: 'Vicki', name: 'Vicki', gender: 'female', languageCode: 'de-DE' },
];

describe('voice choices', () => {
  it('names the language in Spanish with a capital letter', () => {
    expect(languageLabel('es-MX')).toBe('Español (México)');
    expect(languageLabel('de-DE')).toBe('Alemán (Alemania)');
  });

  it('labels each Polly voice with its name, gender and language, sorted by language and name', () => {
    expect(voiceChoices(VOICES)).toEqual([
      { id: 'Vicki', label: 'Vicki · Femenina · Alemán (Alemania)' },
      { id: 'Lupe', label: 'Lupe · Femenina · Español (Estados Unidos)' },
      { id: 'Andres', label: 'Andrés · Masculina · Español (México)' },
      { id: 'Mia', label: 'Mia · Femenina · Español (México)' },
    ]);
  });

  it('shows no voices and the reason when Polly cannot be reached, and retries on the next load', async () => {
    const voices = vi
      .fn<() => Promise<Voice[]>>()
      .mockRejectedValueOnce(new ApiError('InternalError', 'Polly no está disponible en el sandbox: no hay voces para elegir.'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(VOICES);
    const store = new VoiceStore({ voices });
    const first = store.load();
    expect(store.loading.value).toBe(true);
    await first;
    expect(store.loading.value).toBe(false);
    expect(store.choices.value).toEqual([]);
    expect(store.error.value).toBe('Polly no está disponible en el sandbox: no hay voces para elegir.');
    await store.load();
    expect(store.error.value).toBe('No se pudo consultar las voces de Polly.');
    await store.load();
    await store.load();
    expect(store.error.value).toBeNull();
    expect(store.choices.value).toHaveLength(4);
    expect(voices).toHaveBeenCalledTimes(3);
  });
});

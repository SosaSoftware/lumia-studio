import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import type { StudioApi } from '../../api/studio-api.ts';
import { ApiError } from '../../api/graphql-client.ts';
import type { Voice } from '../../api/types.ts';

export type VoiceApi = Pick<StudioApi, 'voices'>;

/** A voice as the narration properties offer it, e.g. "Andrés · Masculina · Español (México)". */
export interface VoiceChoice {
  id: string;
  label: string;
}

const GENDER_LABELS: Readonly<Record<Voice['gender'], string>> = { female: 'Femenina', male: 'Masculina' };
const languageNames = new Intl.DisplayNames(['es'], { type: 'language', languageDisplay: 'standard' });

/** Name of a language in Spanish with a capital letter, e.g. `es-MX` → "Español (México)". */
export function languageLabel(code: string): string {
  let name: string;
  try {
    name = languageNames.of(code) ?? code;
  } catch {
    // An invalid code has no display name; the code itself still tells the voice apart.
    name = code;
  }
  return name.charAt(0).toLocaleUpperCase('es') + name.slice(1);
}

export function voiceLabel(voice: Voice): string {
  return `${voice.name} · ${GENDER_LABELS[voice.gender]} · ${languageLabel(voice.languageCode)}`;
}

/** Voices sorted by language and then by name, so the variants of one language stay together. */
export function voiceChoices(voices: readonly Voice[]): VoiceChoice[] {
  return voices
    .map((voice) => ({ voice, language: languageLabel(voice.languageCode) }))
    .sort((a, b) => a.language.localeCompare(b.language, 'es') || a.voice.name.localeCompare(b.voice.name, 'es'))
    .map(({ voice }) => ({ id: voice.id, label: voiceLabel(voice) }));
}

const UNAVAILABLE = 'No se pudo consultar las voces de Polly.';

/**
 * Polly voices for narration, read from Polly through the API on first use. When Polly cannot be reached there is
 * nothing to choose from, and the reason is shown instead; the next call tries again.
 */
export class VoiceStore {
  public readonly choices: ShallowRef<VoiceChoice[]> = shallowRef([]);
  public readonly error: ShallowRef<string | null> = shallowRef(null);
  public readonly loading: ShallowRef<boolean> = shallowRef(false);
  private request: Promise<void> | null = null;
  private loaded = false;

  public constructor(private readonly api: VoiceApi) {}

  public load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    this.loading.value = true;
    this.request ??= this.api
      .voices()
      .then((voices) => {
        this.choices.value = voiceChoices(voices);
        this.error.value = null;
        this.loaded = true;
      })
      .catch((error: unknown) => {
        this.choices.value = [];
        this.error.value = error instanceof ApiError && error.message !== '' ? error.message : UNAVAILABLE;
      })
      .finally(() => {
        this.request = null;
        this.loading.value = false;
      });
    return this.request;
  }
}

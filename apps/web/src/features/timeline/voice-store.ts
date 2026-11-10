import { computed, shallowRef } from 'vue';
import type { ComputedRef, ShallowRef } from 'vue';
import type { StudioApi } from '../../api/studio-api.ts';
import { ApiError } from '../../api/graphql-client.ts';
import type { Voice } from '../../api/types.ts';
import { compareText, lang, t, upperCase } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/index.ts';

export type VoiceApi = Pick<StudioApi, 'voices'>;

/** A voice as the narration properties offer it, e.g. "Andrés · Masculina · Español (México)". */
export interface VoiceChoice {
  id: string;
  label: string;
}

const displayNames = new Map<Lang, Intl.DisplayNames>();

function languageNames(): Intl.DisplayNames {
  const current = lang.value;
  let names = displayNames.get(current);
  if (names === undefined) {
    names = new Intl.DisplayNames([current], { type: 'language', languageDisplay: 'standard' });
    displayNames.set(current, names);
  }
  return names;
}

/** Name of a language in the interface language with a capital letter, e.g. `es-MX` → "Español (México)". */
export function languageLabel(code: string): string {
  let name: string;
  try {
    name = languageNames().of(code) ?? code;
  } catch {
    // An invalid code has no display name; the code itself still tells the voice apart.
    name = code;
  }
  return upperCase(name.charAt(0)) + name.slice(1);
}

export function voiceLabel(voice: Voice): string {
  return `${voice.name} · ${t(`timeline.gender.${voice.gender}`)} · ${languageLabel(voice.languageCode)}`;
}

/** Voices sorted by language and then by name, so the variants of one language stay together. */
export function voiceChoices(voices: readonly Voice[]): VoiceChoice[] {
  return voices
    .map((voice) => ({ voice, language: languageLabel(voice.languageCode) }))
    .sort((a, b) => compareText(a.language, b.language) || compareText(a.voice.name, b.voice.name))
    .map(({ voice }) => ({ id: voice.id, label: voiceLabel(voice) }));
}

/**
 * Polly voices for narration, read from Polly through the API on first use. When Polly cannot be reached there is
 * nothing to choose from, and the reason is shown instead; the next call tries again.
 */
export class VoiceStore {
  private readonly voices = shallowRef<readonly Voice[]>([]);
  /** Voices as the narration properties offer them; the labels follow the interface language. */
  public readonly choices: ComputedRef<VoiceChoice[]> = computed(() => voiceChoices(this.voices.value));
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
        this.voices.value = voices;
        this.error.value = null;
        this.loaded = true;
      })
      .catch((error: unknown) => {
        this.voices.value = [];
        this.error.value = error instanceof ApiError && error.message !== '' ? error.message : t('timeline.voicesUnavailable');
      })
      .finally(() => {
        this.request = null;
        this.loading.value = false;
      });
    return this.request;
  }
}

import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { Logger } from '../shared/log/index.ts';
import type { SpeechSynthesizer, SpeechVoice, SynthesizeRequest } from '../infrastructure/speech/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type { DeletedResultDto, NarrationClipDto, VoicePageDto } from '../domain/dto.ts';
import { inRange } from '../domain/enums.ts';
import { VersionLocator } from '../repositories/version-locator.ts';
import { decodeOffset, encodeOffset } from '../support/offset-token.ts';
import { StudioService } from './studio-service.ts';

export interface GenerateNarrationRequest {
  id?: string;
  slideId: string;
  script: string;
  startsAtS: number;
  /** Polly voice id; generating needs one, saving does not. */
  voice: string | null;
  speed: number;
}

/** Same fields as a generation request; the script may be empty and the voice null while the clip is being written. */
export type SaveNarrationRequest = GenerateNarrationRequest;

export interface VoiceSearch {
  /** Prefix of the language code, e.g. `es` for every Spanish variant. */
  languageCode?: string;
  limit?: number;
  nextToken?: string;
}

const MAX_SCRIPT_LENGTH = 3000;
const DEFAULT_VOICE_PAGE = 100;
const MAX_VOICE_PAGE = 200;
const FAILURE_MESSAGE = 'No se pudo generar la narración.';

/** Narration clips: stores the clip, synthesizes the voice and keeps the outcome on the clip. */
export class NarrationService extends StudioService {
  public constructor(
    db: Database,
    storage: ObjectStorage,
    private readonly speech: SpeechSynthesizer,
    private readonly logger: Logger,
  ) {
    super(db, storage);
  }

  /** A synthesis failure does not fail the call: the clip is returned as `failed` with its message. */
  public async generate(claims: StudioClaims, request: GenerateNarrationRequest): Promise<NarrationClipDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(request.slideId));
    const script = request.script.trim();
    if (script === '' || script.length > MAX_SCRIPT_LENGTH) {
      throw AppError.validation(`script: debe tener entre 1 y ${String(MAX_SCRIPT_LENGTH)} caracteres.`);
    }
    const voice = NarrationService.voiceOf(request);
    if (voice === null) {
      throw AppError.validation('voice: elige una voz de Polly antes de generar la narración.');
    }
    inRange('startsAtS', request.startsAtS, 0);
    inRange('speed', request.speed, 0.1, 2);
    const current = request.id === undefined ? null : await this.repos.reader.narrationClip(request.id);
    if (request.id !== undefined && current?.slideId !== request.slideId) {
      throw AppError.notFound('El clip de narración no existe en esta diapositiva.');
    }
    if (current?.voice !== voice) {
      await this.requireVoice(voice);
    }
    const values = { startsAtS: request.startsAtS, script, voice, speed: request.speed };
    const clipId = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      let id = request.id;
      if (id === undefined) {
        id = await repos.narration.insertGenerating(request.slideId, values);
      } else {
        await repos.narration.resetToGenerating(id, values);
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return id;
    });
    await this.synthesize(owner.documentId, clipId, script, voice);
    const clip = await this.repos.reader.narrationClip(clipId);
    if (clip === null) {
      throw AppError.notFound('El clip de narración no existe.');
    }
    return clip;
  }

  /**
   * Saves a clip without synthesizing the voice. A new script or voice sends the clip back to `pending`;
   * a new start or speed keeps the generated voice, because the speed only applies on playback.
   */
  public async save(claims: StudioClaims, request: SaveNarrationRequest): Promise<NarrationClipDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(request.slideId));
    const script = request.script.trim();
    if (script.length > MAX_SCRIPT_LENGTH) {
      throw AppError.validation(`script: debe tener como máximo ${String(MAX_SCRIPT_LENGTH)} caracteres.`);
    }
    const voice = NarrationService.voiceOf(request);
    inRange('startsAtS', request.startsAtS, 0);
    inRange('speed', request.speed, 0.1, 2);
    const current = request.id === undefined ? null : await this.repos.reader.narrationClip(request.id);
    if (request.id !== undefined && current?.slideId !== request.slideId) {
      throw AppError.notFound('El clip de narración no existe en esta diapositiva.');
    }
    // A voice is checked when it is picked; a voice kept from before stays even while Polly is unreachable.
    if (voice !== null && voice !== (current?.voice ?? null)) {
      await this.requireVoice(voice);
    }
    const values = { startsAtS: request.startsAtS, script, voice, speed: request.speed };
    const clipId = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      let id = request.id;
      if (id === undefined || current === null) {
        id = await repos.narration.insertPending(request.slideId, values);
      } else if (current.script !== script || current.voice !== voice) {
        await repos.narration.resetToPending(id, values);
      } else {
        await repos.narration.updateTiming(id, request.startsAtS, request.speed);
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return id;
    });
    const clip = await this.repos.reader.narrationClip(clipId);
    if (clip === null) {
      throw AppError.notFound('El clip de narración no existe.');
    }
    return clip;
  }

  /** Voices of the synthesis engine, as Polly lists them. */
  public async voices(search: VoiceSearch): Promise<VoicePageDto> {
    const prefix = search.languageCode?.trim().toLowerCase() ?? '';
    const matching = (await this.pollyVoices()).filter((voice) => voice.languageCode.toLowerCase().startsWith(prefix));
    const limit = Math.min(Math.max(search.limit ?? DEFAULT_VOICE_PAGE, 1), MAX_VOICE_PAGE);
    const offset = decodeOffset(search.nextToken);
    return {
      items: matching.slice(offset, offset + limit).map((voice) => ({ ...voice })),
      nextToken: offset + limit < matching.length ? encodeOffset(offset + limit) : null,
    };
  }

  public async delete(claims: StudioClaims, clipId: string): Promise<DeletedResultDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofChild('narration_clip', clipId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      await repos.narration.delete(clipId);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return { id: clipId, deleted: true };
  }

  private static voiceOf(request: GenerateNarrationRequest): string | null {
    const voice = request.voice?.trim() ?? '';
    return voice === '' ? null : voice;
  }

  /** Voices as Polly lists them now; nothing is cached in the database, so every voice offered exists. */
  private async pollyVoices(): Promise<readonly SpeechVoice[]> {
    try {
      return await this.speech.voices();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.warn('Polly voice list failed', { error });
      throw AppError.internal('No se pudo consultar las voces de Polly.');
    }
  }

  private async requireVoice(id: string): Promise<void> {
    const voices = await this.pollyVoices();
    if (!voices.some((voice) => voice.id === id)) {
      throw AppError.validation('voice: no es una voz disponible en Polly.');
    }
  }

  private async synthesize(documentId: string, clipId: string, script: string, voice: string): Promise<void> {
    try {
      // The id was checked against Polly's voice list when it was picked (`requireVoice`); Polly rejects it if it was removed since.
      const voiceId = voice as SynthesizeRequest['voiceId'];
      const speech = await this.speech.synthesize({ text: script, voiceId });
      const audioKey = `narration/${documentId}/${clipId}.mp3`;
      const marksKey = `narration/${documentId}/${clipId}.marks.json`;
      await this.storage.put(audioKey, speech.audio, 'audio/mpeg');
      await this.storage.put(marksKey, speech.speechMarks, 'application/json');
      await this.repos.narration.markReady(clipId, audioKey, marksKey, speech.durationS);
    } catch (error) {
      this.logger.warn('Narration synthesis failed', { clipId, error });
      await this.repos.narration.markFailed(clipId, error instanceof AppError ? error.message : FAILURE_MESSAGE);
    }
  }
}

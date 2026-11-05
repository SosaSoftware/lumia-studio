import type { StudioClaims } from '../auth/index.ts';
import type { Database } from '../infrastructure/db/index.ts';
import { AppError } from '../shared/errors/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import type { AudioClipDto, DeletedResultDto, PauseDto, SlideCommentDto } from '../domain/dto.ts';
import { AUDIO_KINDS, PAUSE_ENDS, inRange, oneOf } from '../domain/enums.ts';
import { VersionLocator } from '../repositories/version-locator.ts';
import { StudioService } from './studio-service.ts';

export interface SavePauseRequest {
  id?: string;
  slideId: string;
  startsAtS: number;
  durationS: number;
  message: string;
  onEnd: string;
  timerElementId?: string;
}

export interface SaveAudioRequest {
  id?: string;
  slideId: string;
  mediaId: string;
  startsAtS: number;
  durationS: number;
  name: string;
  kind: string;
  volume?: number;
}

const MAX_COMMENT_LENGTH = 2000;

/** Pauses, audio clips and comments of the draft version. */
export class TimelineService extends StudioService {
  public constructor(db: Database, storage: ObjectStorage) {
    super(db, storage);
  }

  public async savePause(claims: StudioClaims, request: SavePauseRequest): Promise<PauseDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(request.slideId));
    inRange('startsAtS', request.startsAtS, 0);
    inRange('durationS', request.durationS, 0);
    const onEnd = oneOf('onEnd', request.onEnd, PAUSE_ENDS);
    const timerElementId = request.timerElementId ?? null;
    if (timerElementId !== null && !(await this.repos.timeline.elementInSlide(timerElementId, request.slideId))) {
      throw AppError.validation('timerElementId: el elemento no existe en esta diapositiva.');
    }
    if (request.id !== undefined && (await this.repos.timeline.pauseSlide(request.id)) !== request.slideId) {
      throw AppError.notFound('La pausa no existe en esta diapositiva.');
    }
    const values = {
      startsAtS: request.startsAtS, durationS: request.durationS, message: request.message, onEnd, timerElementId,
    };
    const id = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const pauseId = request.id ?? (await repos.timeline.insertPause(request.slideId, values));
      if (request.id !== undefined) {
        await repos.timeline.updatePause(request.id, values);
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return pauseId;
    });
    return this.found(await this.repos.reader.pause(id), 'La pausa no existe.');
  }

  public async deletePause(claims: StudioClaims, pauseId: string): Promise<DeletedResultDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofChild('pause', pauseId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      await repos.timeline.deletePause(pauseId);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return { id: pauseId, deleted: true };
  }

  public async saveAudio(claims: StudioClaims, request: SaveAudioRequest): Promise<AudioClipDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(request.slideId));
    inRange('startsAtS', request.startsAtS, 0);
    inRange('durationS', request.durationS, 0);
    const volume = inRange('volume', request.volume ?? 1, 0, 1);
    const kind = oneOf('kind', request.kind, AUDIO_KINDS);
    const media = await this.repos.media.find(request.mediaId);
    if (media?.categoryId !== owner.categoryId) {
      throw AppError.validation('mediaId: el medio no existe en la biblioteca de esta categoría.');
    }
    if (!media.mimeType.startsWith('audio/')) {
      throw AppError.validation('mediaId: el medio debe ser un archivo de audio.');
    }
    if (request.id !== undefined && (await this.repos.timeline.audioSlide(request.id)) !== request.slideId) {
      throw AppError.notFound('El clip de audio no existe en esta diapositiva.');
    }
    const values = {
      mediaId: request.mediaId, startsAtS: request.startsAtS, durationS: request.durationS, name: request.name, kind, volume,
    };
    const id = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const clipId = request.id ?? (await repos.timeline.insertAudio(request.slideId, values));
      if (request.id !== undefined) {
        await repos.timeline.updateAudio(request.id, values);
      }
      await repos.documents.touch(owner.documentId, claims.sub);
      return clipId;
    });
    return this.found(await this.repos.reader.audioClip(id), 'El clip de audio no existe.');
  }

  public async deleteAudio(claims: StudioClaims, audioClipId: string): Promise<DeletedResultDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofChild('audio_clip', audioClipId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      await repos.timeline.deleteAudio(audioClipId);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return { id: audioClipId, deleted: true };
  }

  public async saveComment(claims: StudioClaims, slideId: string, body: string): Promise<SlideCommentDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofSlide(slideId));
    const text = body.trim();
    if (text === '' || text.length > MAX_COMMENT_LENGTH) {
      throw AppError.validation(`body: debe tener entre 1 y ${String(MAX_COMMENT_LENGTH)} caracteres.`);
    }
    const id = await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      const commentId = await repos.timeline.insertComment(slideId, claims.sub, claims.name === '' ? claims.email : claims.name, text);
      await repos.documents.touch(owner.documentId, claims.sub);
      return commentId;
    });
    return this.found(await this.repos.reader.comment(id), 'El comentario no existe.');
  }

  public async deleteComment(claims: StudioClaims, commentId: string): Promise<DeletedResultDto> {
    const owner = VersionLocator.requireDraft(await this.repos.locator.ofChild('slide_comment', commentId));
    await this.inTransaction(async (repos) => {
      await repos.locator.lockDraft(owner.versionId);
      await repos.timeline.deleteComment(commentId);
      await repos.documents.touch(owner.documentId, claims.sub);
    });
    return { id: commentId, deleted: true };
  }

  private found<T>(value: T | null, message: string): T {
    if (value === null) {
      throw AppError.notFound(message);
    }
    return value;
  }
}

import { z } from 'zod';
import { ACTIONS } from '../../auth/index.ts';
import { AUDIO_KINDS, PAUSE_ENDS } from '../../domain/enums.ts';
import { AUDIO_FIELDS, PAUSE_FIELDS, decodeAudio, decodePause } from '../class-data.ts';
import { record } from '../decode.ts';
import { draftNotice, findAudio, findPause, openDraft } from '../draft.ts';
import type { StudioTool } from '../tool-definition.ts';
import { defineTool } from '../tool-definition.ts';
import { ToolError } from '../tool-error.ts';
import { nodeIdInput, secondsInput, slideIdInput } from './inputs.ts';
import { slideFor } from './timeline-support.ts';

const audioIdInput = z.string().min(1).describe('Id del audio en la línea de tiempo (get_slide).');
const pauseIdInput = z.string().min(1).describe('Id de la pausa (get_slide).');

const saveAudioClip = defineTool({
  name: 'save_audio_clip',
  description:
    'Pone un audio de la biblioteca (search_media con type audio) en la línea de tiempo de una diapositiva, o ajusta uno existente: inicio, duración, nombre, tipo y volumen.',
  action: ACTIONS.documentsEdit,
  input: z.object({
    nodeId: nodeIdInput,
    slideId: slideIdInput.optional().describe('Diapositiva del audio nuevo.'),
    audioClipId: audioIdInput.optional().describe('Audio que cambia; sin valor se crea uno nuevo.'),
    mediaId: z.string().min(1).optional().describe('Id del archivo de audio de la biblioteca. Obligatorio al crear.'),
    startsAtS: secondsInput.optional().describe('Segundo en que empieza. Al crear, 0 si no se indica.'),
    durationS: z.number().positive().optional().describe('Cuántos segundos suena. Obligatorio al crear.'),
    name: z.string().trim().min(1).optional().describe('Nombre en la línea de tiempo.'),
    kind: z.enum(AUDIO_KINDS).optional().describe('music para fondo musical, effect para un efecto. Al crear, music.'),
    volume: z.number().min(0).max(1).optional().describe('Volumen de 0 a 1.'),
  }),
  run: async (args, { studio }) => {
    const session = await openDraft(studio, args.nodeId);
    const current = args.audioClipId === undefined ? null : findAudio(session.version, session.remap.id(args.audioClipId));
    const mediaId = args.mediaId ?? current?.item.mediaId;
    const durationS = args.durationS ?? current?.item.durationS;
    if (mediaId === undefined) throw ToolError.invalidInput('mediaId: elige un audio de la biblioteca con search_media.');
    if (durationS === undefined) throw ToolError.invalidInput('durationS: indica cuántos segundos suena.');
    const input = {
      ...(current === null ? {} : { id: current.item.id }),
      slideId: current?.slide.id ?? slideFor(session, args.slideId, 'el audio'),
      mediaId,
      startsAtS: args.startsAtS ?? current?.item.startsAtS ?? 0,
      durationS,
      name: args.name ?? current?.item.name ?? 'Audio',
      kind: args.kind ?? current?.item.kind ?? 'music',
      volume: args.volume ?? current?.item.volume ?? 1,
    };
    const data = await studio.request(`mutation($i: AudioClipInput!) { saveAudio(input: $i) { ${AUDIO_FIELDS} } }`, { i: input });
    return { audioClip: decodeAudio(data.saveAudio), ...draftNotice(session) };
  },
});

const deleteAudioClip = defineTool({
  name: 'delete_audio_clip',
  description: 'Quita un audio de la línea de tiempo; el archivo sigue en la biblioteca. Antes de llamarla, pide confirmación a la persona con la herramienta de interfaz confirm_change.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, audioClipId: audioIdInput }),
  run: async ({ nodeId, audioClipId }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const { item } = findAudio(session.version, session.remap.id(audioClipId));
    const result = record((await studio.request('mutation($a: ID!) { deleteAudio(audioClipId: $a) { id deleted } }', { a: item.id })).deleteAudio);
    return { deleted: result.deleted === true, audioClipId: item.id, ...draftNotice(session) };
  },
});

const savePause = defineTool({
  name: 'save_pause',
  description: 'Crea una pausa en la línea de tiempo (sin pauseId) o cambia una existente: inicio, duración, mensaje y qué pasa al terminar.',
  action: ACTIONS.documentsEdit,
  input: z.object({
    nodeId: nodeIdInput,
    slideId: slideIdInput.optional().describe('Diapositiva de la pausa nueva.'),
    pauseId: pauseIdInput.optional().describe('Pausa que cambia; sin valor se crea una nueva.'),
    startsAtS: secondsInput.optional().describe('Segundo en que empieza. Obligatorio al crear.'),
    durationS: secondsInput.optional().describe('Cuántos segundos dura. Obligatorio al crear.'),
    message: z.string().optional().describe('Mensaje que ve el estudiante durante la pausa.'),
    onEnd: z.enum(PAUSE_ENDS).optional().describe('continue: sigue sola; wait_click: espera un clic. Al crear, continue.'),
    timerElementId: z.string().min(1).nullable().optional().describe('Temporizador de la diapositiva que muestra la cuenta; null para ninguno.'),
  }),
  run: async (args, { studio }) => {
    const session = await openDraft(studio, args.nodeId);
    const current = args.pauseId === undefined ? null : findPause(session.version, session.remap.id(args.pauseId));
    const startsAtS = args.startsAtS ?? current?.item.startsAtS;
    const durationS = args.durationS ?? current?.item.durationS;
    if (startsAtS === undefined || durationS === undefined) throw ToolError.invalidInput('startsAtS y durationS: indica cuándo empieza la pausa y cuánto dura.');
    const timer = args.timerElementId === undefined ? (current?.item.timerElementId ?? null) : args.timerElementId;
    const input = {
      ...(current === null ? {} : { id: current.item.id }),
      slideId: current?.slide.id ?? slideFor(session, args.slideId, 'la pausa'),
      startsAtS,
      durationS,
      message: args.message ?? current?.item.message ?? '',
      onEnd: args.onEnd ?? current?.item.onEnd ?? 'continue',
      timerElementId: timer === null ? null : session.remap.id(timer),
    };
    const data = await studio.request(`mutation($i: PauseInput!) { savePause(input: $i) { ${PAUSE_FIELDS} } }`, { i: input });
    return { pause: decodePause(data.savePause), ...draftNotice(session) };
  },
});

const deletePause = defineTool({
  name: 'delete_pause',
  description: 'Borra una pausa de la línea de tiempo. Antes de llamarla, pide confirmación a la persona con la herramienta de interfaz confirm_change.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, pauseId: pauseIdInput }),
  run: async ({ nodeId, pauseId }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const { item } = findPause(session.version, session.remap.id(pauseId));
    const result = record((await studio.request('mutation($p: ID!) { deletePause(pauseId: $p) { id deleted } }', { p: item.id })).deletePause);
    return { deleted: result.deleted === true, pauseId: item.id, ...draftNotice(session) };
  },
});

export const TRACK_TOOLS: readonly StudioTool[] = [saveAudioClip, deleteAudioClip, savePause, deletePause];

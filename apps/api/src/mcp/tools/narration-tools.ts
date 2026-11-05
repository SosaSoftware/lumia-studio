import { z } from 'zod';
import { ACTIONS } from '../../auth/index.ts';
import { NARRATION_FIELDS, decodeNarration } from '../class-data.ts';
import { record } from '../decode.ts';
import { draftNotice, findNarration, openDraft } from '../draft.ts';
import type { StudioTool } from '../tool-definition.ts';
import { defineTool } from '../tool-definition.ts';
import { ToolError } from '../tool-error.ts';
import { nodeIdInput, secondsInput, slideIdInput } from './inputs.ts';
import { slideFor } from './timeline-support.ts';

const narrationIdInput = z.string().min(1).describe('Id de la narración (get_slide).');

const saveNarration = defineTool({
  name: 'save_narration',
  description:
    'Crea una narración (sin narrationClipId) o cambia una existente: guion, segundo de inicio, voz y velocidad. No genera el audio; para eso usa generate_narration_audio.',
  action: ACTIONS.documentsEdit,
  input: z.object({
    nodeId: nodeIdInput,
    slideId: slideIdInput.optional().describe('Diapositiva de la narración nueva.'),
    narrationClipId: narrationIdInput.optional().describe('Narración que cambia; sin valor se crea una nueva.'),
    script: z.string().trim().min(1).optional().describe('Guion que se lee. Obligatorio al crear.'),
    startsAtS: secondsInput.optional().describe('Segundo de la diapositiva en que empieza. Al crear, 0 si no se indica.'),
    voice: z.string().min(1).nullable().optional().describe('Id de la voz (list_voices); null para quitarla.'),
    speed: z.number().min(0.1).max(2).optional().describe('Velocidad de lectura; 1 es normal.'),
  }),
  run: async (args, { studio }) => {
    const session = await openDraft(studio, args.nodeId);
    const current = args.narrationClipId === undefined ? null : findNarration(session.version, session.remap.id(args.narrationClipId));
    const script = args.script ?? current?.item.script;
    if (script === undefined) throw ToolError.invalidInput('script: escribe el guion de la narración.');
    const input = {
      ...(current === null ? {} : { id: current.item.id }),
      slideId: current?.slide.id ?? slideFor(session, args.slideId, 'la narración'),
      script,
      startsAtS: args.startsAtS ?? current?.item.startsAtS ?? 0,
      voice: args.voice === undefined ? (current?.item.voice ?? null) : args.voice,
      speed: args.speed ?? current?.item.speed ?? 1,
    };
    const data = await studio.request(`mutation($i: NarrationInput!) { saveNarration(input: $i) { ${NARRATION_FIELDS} } }`, { i: input });
    return { narration: decodeNarration(data.saveNarration), ...draftNotice(session) };
  },
});

const generateNarrationAudio = defineTool({
  name: 'generate_narration_audio',
  description: 'Genera con Amazon Polly el audio de una narración ya guardada. Necesita una voz: la de la narración o la que indiques.',
  action: ACTIONS.narrationGenerate,
  input: z.object({
    nodeId: nodeIdInput,
    narrationClipId: narrationIdInput,
    voice: z.string().min(1).optional().describe('Id de la voz (list_voices); sin valor, la que ya tiene la narración.'),
  }),
  run: async ({ nodeId, narrationClipId, voice }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const { slide, item } = findNarration(session.version, session.remap.id(narrationClipId));
    const chosen = voice ?? item.voice;
    if (chosen === null) throw ToolError.invalidInput('voice: la narración no tiene voz; elige una con list_voices.');
    const input = { id: item.id, slideId: slide.id, script: item.script, startsAtS: item.startsAtS, voice: chosen, speed: item.speed };
    const data = await studio.request(`mutation($i: NarrationInput!) { generateNarration(input: $i) { ${NARRATION_FIELDS} } }`, { i: input });
    return { narration: decodeNarration(data.generateNarration), ...draftNotice(session) };
  },
});

const deleteNarration = defineTool({
  name: 'delete_narration',
  description: 'Borra una narración y su audio. Antes de llamarla, pide confirmación a la persona con la herramienta de interfaz confirm_change.',
  action: ACTIONS.documentsEdit,
  input: z.object({ nodeId: nodeIdInput, narrationClipId: narrationIdInput }),
  run: async ({ nodeId, narrationClipId }, { studio }) => {
    const session = await openDraft(studio, nodeId);
    const { item } = findNarration(session.version, session.remap.id(narrationClipId));
    const result = record((await studio.request('mutation($n: ID!) { deleteNarration(narrationClipId: $n) { id deleted } }', { n: item.id })).deleteNarration);
    return { deleted: result.deleted === true, narrationClipId: item.id, ...draftNotice(session) };
  },
});

export const NARRATION_TOOLS: readonly StudioTool[] = [saveNarration, generateNarrationAudio, deleteNarration];

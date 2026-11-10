import type { FieldCommand } from '../../graphql/appsync/index.ts';
import { commandMap } from '../../support/function-command.ts';
import type { InputReader } from '../../support/input-reader.ts';
import type { CatalogService } from '../../services/catalog-service.ts';
import type { DocumentService } from '../../services/document-service.ts';
import type { DraftElement, DraftSlide, SaveElementRequest, SaveSlideRequest, SlideService } from '../../services/slide-service.ts';
import type { SaveAudioRequest, SavePauseRequest, TimelineService } from '../../services/timeline-service.ts';

export interface DocumentsServices {
  documents: DocumentService;
  slides: SlideService;
  timeline: TimelineService;
  catalog: CatalogService;
}

/** Builds an object without the keys whose value is undefined, so optional fields stay absent. */
function defined<T extends object>(values: T): T {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as T; // same keys, fewer of them
}

function slideRequest(input: InputReader): SaveSlideRequest {
  return defined({
    id: input.optionalId('id'),
    versionId: input.id('versionId'),
    position: input.optionalInteger('position'),
    title: input.optionalString('title'),
    background: input.optionalString('background'),
    durationS: input.optionalNumber('durationS'),
    transition: input.optionalString('transition'),
    advance: input.optionalString('advance'),
  });
}

function elementRequest(input: InputReader): SaveElementRequest {
  return defined({
    id: input.optionalId('id'),
    slideId: input.id('slideId'),
    component: input.string('component'),
    name: input.optionalString('name'),
    x: input.optionalNumber('x'),
    y: input.optionalNumber('y'),
    w: input.optionalNumber('w'),
    h: input.optionalNumber('h'),
    z: input.optionalInteger('z'),
    appearsAtS: input.optionalNumber('appearsAtS'),
    entrance: input.optionalString('entrance'),
    props: input.json('props'),
    mediaId: input.optionalId('mediaId'),
  });
}

function draftElement(input: InputReader): DraftElement {
  return defined({
    component: input.string('component'),
    name: input.optionalString('name'),
    x: input.number('x'),
    y: input.number('y'),
    w: input.number('w'),
    h: input.number('h'),
    z: input.optionalInteger('z') ?? 0,
    appearsAtS: input.number('appearsAtS'),
    entrance: input.optionalString('entrance'),
    props: input.json('props'),
  });
}

function draftSlide(input: InputReader): DraftSlide {
  return defined({
    title: input.string('title'),
    background: input.optionalString('background'),
    durationS: input.optionalNumber('durationS'),
    transition: input.optionalString('transition'),
    advance: input.optionalString('advance'),
    elements: input.objects('elements').map(draftElement),
  });
}

function pauseRequest(input: InputReader): SavePauseRequest {
  return defined({
    id: input.optionalId('id'),
    slideId: input.id('slideId'),
    startsAtS: input.number('startsAtS'),
    durationS: input.number('durationS'),
    message: input.string('message'),
    onEnd: input.string('onEnd'),
    timerElementId: input.optionalId('timerElementId'),
  });
}

function audioRequest(input: InputReader): SaveAudioRequest {
  return defined({
    id: input.optionalId('id'),
    slideId: input.id('slideId'),
    mediaId: input.id('mediaId'),
    startsAtS: input.number('startsAtS'),
    durationS: input.number('durationS'),
    name: input.string('name'),
    kind: input.string('kind'),
    volume: input.optionalNumber('volume'),
  });
}

/** Maps each field of the `documents` handler to the service call that resolves it. */
export function documentsCommands(services: DocumentsServices): Map<string, FieldCommand> {
  const { documents, slides, timeline, catalog } = services;
  return commandMap({
    'Query.document': (call) => documents.document(call.args.id('nodeId')),
    'Query.version': (call) => documents.version(call.args.id('id')),
    'Query.componentCatalog': () => Promise.resolve(catalog.describe()),
    'Mutation.createDocument': (call) => documents.createDocument(call.claims, call.args.id('nodeId')),
    'Mutation.createVersion': (call) => documents.createVersion(call.claims, call.args.id('documentId')),
    'Mutation.saveSlide': (call) => slides.saveSlide(call.claims, slideRequest(call.args.object('input'))),
    'Mutation.reorderSlides': (call) => slides.reorderSlides(call.claims, call.args.id('versionId'), call.args.ids('slideIds')),
    'Mutation.duplicateSlide': (call) => slides.duplicateSlide(call.claims, call.args.id('slideId')),
    'Mutation.deleteSlide': (call) => slides.deleteSlide(call.claims, call.args.id('slideId')),
    'Mutation.saveElement': (call) => slides.saveElement(call.claims, elementRequest(call.args.object('input'))),
    'Mutation.deleteElement': (call) => slides.deleteElement(call.claims, call.args.id('elementId')),
    'Mutation.applySlidesDraft': (call) =>
      slides.applySlidesDraft(
        call.claims,
        call.args.id('versionId'),
        call.args.optionalInteger('afterPosition'),
        call.args.objects('slides').map(draftSlide),
      ),
    'Mutation.savePause': (call) => timeline.savePause(call.claims, pauseRequest(call.args.object('input'))),
    'Mutation.deletePause': (call) => timeline.deletePause(call.claims, call.args.id('pauseId')),
    'Mutation.saveAudio': (call) => timeline.saveAudio(call.claims, audioRequest(call.args.object('input'))),
    'Mutation.deleteAudio': (call) => timeline.deleteAudio(call.claims, call.args.id('audioClipId')),
    'Mutation.saveComment': (call) => timeline.saveComment(call.claims, call.args.id('slideId'), call.args.string('body')),
    'Mutation.deleteComment': (call) => timeline.deleteComment(call.claims, call.args.id('commentId')),
  });
}

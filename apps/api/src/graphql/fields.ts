import { ACTIONS } from '../auth/index.ts';
import type { FieldDefinition } from './appsync/index.ts';

type Resource = NonNullable<FieldDefinition['resource']>;

function query(field: string, handler: string, resource?: Resource): FieldDefinition {
  return { type: 'Query', field, action: ACTIONS.documentsView, handler, ...(resource === undefined ? {} : { resource }) };
}

function mutation(field: string, action: string, handler: string, resource?: Resource): FieldDefinition {
  return { type: 'Mutation', field, action, handler, ...(resource === undefined ? {} : { resource }) };
}

const edit = (field: string, resource?: Resource): FieldDefinition => mutation(field, ACTIONS.documentsEdit, 'documents', resource);

/**
 * Fields of the Lumia Studio API with their Cedar action and the record that scopes them.
 * The local server uses them today and the CDK stack later.
 * `categories` has no record: its query keeps only the categories and subcategories granted to the person.
 * The CDK creates one AppSync resolver per entry, on the Lambda data source named by `handler`.
 */
export const STUDIO_FIELDS: FieldDefinition[] = [
  query('categories', 'tree'),
  query('me', 'tree'),
  query('treeNodes', 'tree', { type: 'subcategory', idArg: 'filter.subcategoryId' }),
  query('document', 'documents', { type: 'node', idArg: 'nodeId' }),
  query('version', 'documents', { type: 'version', idArg: 'id' }),
  query('mediaLibrary', 'media', { type: 'category', idArg: 'filter.categoryId' }),
  query('componentCatalog', 'documents'),
  query('narrationVoices', 'narration'),

  edit('createDocument', { type: 'node', idArg: 'nodeId' }),
  edit('createVersion', { type: 'document', idArg: 'documentId' }),
  edit('saveSlide', { type: 'version', idArg: 'input.versionId' }),
  edit('reorderSlides', { type: 'version', idArg: 'versionId' }),
  edit('duplicateSlide', { type: 'slide', idArg: 'slideId' }),
  edit('deleteSlide', { type: 'slide', idArg: 'slideId' }),
  edit('saveElement', { type: 'slide', idArg: 'input.slideId' }),
  edit('deleteElement', { type: 'element', idArg: 'elementId' }),
  edit('applySlidesDraft', { type: 'version', idArg: 'versionId' }),
  edit('savePause', { type: 'slide', idArg: 'input.slideId' }),
  edit('deletePause', { type: 'pause', idArg: 'pauseId' }),
  edit('saveAudio', { type: 'slide', idArg: 'input.slideId' }),
  edit('deleteAudio', { type: 'audio', idArg: 'audioClipId' }),
  edit('saveComment', { type: 'slide', idArg: 'slideId' }),
  edit('deleteComment', { type: 'comment', idArg: 'commentId' }),

  mutation('createMediaUpload', ACTIONS.mediaUpload, 'media', { type: 'category', idArg: 'input.categoryId' }),
  mutation('registerMedia', ACTIONS.mediaUpload, 'media', { type: 'category', idArg: 'input.categoryId' }),
  mutation('generateNarration', ACTIONS.narrationGenerate, 'narration', { type: 'slide', idArg: 'input.slideId' }),
  mutation('saveNarration', ACTIONS.documentsEdit, 'narration', { type: 'slide', idArg: 'input.slideId' }),
  mutation('deleteNarration', ACTIONS.documentsEdit, 'narration', { type: 'narration', idArg: 'narrationClipId' }),
  mutation('publishVersion', ACTIONS.documentsPublish, 'publish', { type: 'document', idArg: 'documentId' }),
];

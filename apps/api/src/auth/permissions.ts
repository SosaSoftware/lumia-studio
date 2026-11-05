/** One action that a role can grant. */
export interface PermissionDefinition {
  readonly key: string;
  readonly section: string;
  readonly name: string;
}

/** Actions of Lumia Studio. Every GraphQL field declares one of them, and roles grant them in `studio.role_permission`. */
export const ACTIONS = {
  documentsView: 'documents.view',
  documentsEdit: 'documents.edit',
  documentsPublish: 'documents.publish',
  mediaUpload: 'media.upload',
  narrationGenerate: 'narration.generate',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  { key: ACTIONS.documentsView, section: 'Clases', name: 'Ver el árbol y el contenido de las clases' },
  { key: ACTIONS.documentsEdit, section: 'Clases', name: 'Editar el contenido de las clases' },
  { key: ACTIONS.documentsPublish, section: 'Publicación', name: 'Publicar versiones' },
  { key: ACTIONS.mediaUpload, section: 'Medios', name: 'Subir medios' },
  { key: ACTIONS.narrationGenerate, section: 'Narración', name: 'Generar narración' },
];

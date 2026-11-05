import { ACTIONS, PERMISSION_CATALOG } from '@lumia/api/auth';

/** A folder (with children) or a class of the seed tree. Names follow the logical-name rules of `studio.tree_node`. */
export type SeedNode =
  | { kind: 'folder'; name: string; displayName: string; description?: string; children: SeedNode[] }
  | { kind: 'class'; name: string; displayName: string; description?: string };

export interface SeedSubcategory {
  name: string;
  displayName: string;
  description?: string;
  /** Heading that groups it in the menus. */
  group?: string;
  tree: SeedNode[];
}

export interface SeedCategory {
  name: string;
  displayName: string;
  description?: string;
  /** Heading that groups it in the menus. */
  group?: string;
  subcategories: SeedSubcategory[];
}

export interface SeedRole {
  key: string;
  name: string;
  description: string;
  actions: readonly string[];
}

/** A person of the sandbox; `grants` names categories (`category`) or single subcategories (`category/subcategory`). */
export interface SeedPerson {
  email: string;
  name: string;
  role: string | null;
  grants: readonly string[];
}

const folder = (name: string, displayName: string, children: SeedNode[], description?: string): SeedNode => ({
  kind: 'folder',
  name,
  displayName,
  children,
  ...(description === undefined ? {} : { description }),
});

const lesson = (name: string, displayName: string, description?: string): SeedNode => ({
  kind: 'class',
  name: `${name}.lumia`,
  displayName,
  ...(description === undefined ? {} : { description }),
});

export const SEED_ROLES: readonly SeedRole[] = [
  { key: 'admin', name: 'Administración', description: 'Todas las acciones de Studio.', actions: PERMISSION_CATALOG.map((permission) => permission.key) },
  {
    key: 'content_creator',
    name: 'Creación de contenido',
    description: 'Edita y publica el contenido de las clases existentes.',
    actions: [ACTIONS.documentsView, ACTIONS.documentsEdit, ACTIONS.documentsPublish, ACTIONS.mediaUpload, ACTIONS.narrationGenerate],
  },
  { key: 'viewer', name: 'Lectura', description: 'Ve el árbol y el contenido sin editarlo.', actions: [ACTIONS.documentsView] },
];

export const SEED_PEOPLE: readonly SeedPerson[] = [
  { email: 'admin@studio.test', name: 'Andrea Morales', role: 'admin', grants: ['academia-lumia', 'escuela-de-ciencias'] },
  { email: 'creadora@studio.test', name: 'Carlos Sosa', role: 'content_creator', grants: ['academia-lumia'] },
  { email: 'matematicas@studio.test', name: 'Mario Pérez', role: 'content_creator', grants: ['academia-lumia/matematicas'] },
  { email: 'lectora@studio.test', name: 'Lucía Ramírez', role: 'viewer', grants: ['academia-lumia'] },
  { email: 'sin-acceso@studio.test', name: 'Sofía Castro', role: null, grants: [] },
];

/** Class whose content shows every component of the catalog (see `showcase.ts`). */
export const SHOWCASE_CLASS = { category: 'academia-lumia', subcategory: 'inteligencia-artificial', path: ['fundamentos', 'que-es-la-ia.lumia'] } as const;

/** Person whose claims create the showcase content. */
export const SHOWCASE_AUTHOR = 'creadora@studio.test';

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  {
    name: 'academia-lumia',
    displayName: 'Academia Lumia',
    group: 'Academias',
    description: 'Cursos de ejemplo del sandbox.',
    subcategories: [
      {
        name: 'inteligencia-artificial',
        displayName: 'Inteligencia artificial',
        group: 'Lumia',
        description: 'Fundamentos y uso responsable de la inteligencia artificial.',
        tree: [
          folder('fundamentos', 'Fundamentos', [
            lesson('que-es-la-ia', '¿Qué es la inteligencia artificial?', 'Recorrido por todos los componentes del catálogo.'),
            lesson('aprender-con-ejemplos', 'Las máquinas aprenden con ejemplos', 'Cómo un sistema encuentra patrones en los datos.'),
            folder('datos', 'Los datos', [
              lesson('tipos-de-datos', 'Fotos, sonidos y textos son datos'),
              lesson('datos-y-patrones', 'De los datos a los patrones'),
            ], 'Qué son los datos y cómo se usan para aprender.'),
          ], 'Conceptos básicos para empezar.'),
          folder('uso-responsable', 'Uso responsable', [
            lesson('informacion-personal', 'Cuidar la información personal'),
            lesson('revisar-respuestas', 'Revisar si una respuesta es correcta'),
          ]),
          lesson('repaso-general', 'Repaso general', 'Clase de repaso de todo el curso.'),
        ],
      },
      {
        name: 'matematicas',
        displayName: 'Matemáticas',
        group: 'CNB',
        tree: [
          folder('fracciones', 'Fracciones', [
            lesson('que-es-una-fraccion', '¿Qué es una fracción?'),
            lesson('fracciones-equivalentes', 'Fracciones equivalentes'),
          ]),
          folder('geometria', 'Geometría', [lesson('figuras-planas', 'Figuras planas')]),
        ],
      },
    ],
  },
  {
    name: 'escuela-de-ciencias',
    displayName: 'Escuela de Ciencias',
    subcategories: [
      {
        name: 'biologia',
        displayName: 'Biología',
        tree: [folder('la-celula', 'La célula', [lesson('partes-de-la-celula', 'Partes de la célula')])],
      },
    ],
  },
];

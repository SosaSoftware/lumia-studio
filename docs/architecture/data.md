# Datos

Lumia Studio guarda su contenido en Aurora PostgreSQL, en el esquema `studio`, y sus archivos en buckets de S3. Las migraciones crean el esquema, pero no cargan roles, personas ni árbol. Esta página describe la base de datos, las tablas, el ciclo de una clase, las migraciones, los buckets y la retención de datos.

## Base de datos

Aurora PostgreSQL Serverless v2 vive en `LumiaStudioDataStack`, en subredes aisladas y sin NAT. Las funciones usan la Data API y la base no recibe conexiones de red. Por defecto escala hasta 0 ACU y se pausa sin conexiones; reanudar toma unos 15 segundos. La capacidad se configura en [operations/deployment.md](../operations/deployment.md).

| Usuario | Uso |
|---|---|
| `lumia_admin` | Administrador. Las migraciones y la carga manual de datos usan su secreto. |
| `studio_app` | Usuario de la API. Lee y escribe las tablas de `studio`. La Lambda de migraciones asigna su contraseña. |

En local, el sandbox usa Postgres 16 en Docker con los mismos dos usuarios.

## Esquema `studio`

| Dato | Tabla | Descripción |
|---|---|---|
| Categoría | `studio.category` | Primer nivel del árbol. Tiene su propia biblioteca de medios. |
| Subcategoría | `studio.subcategory` | Pertenece a una categoría. |
| Carpeta o clase | `studio.tree_node` | `kind` es `folder` o `class`. Una clase es una hoja. |
| Documento | `studio.class_document` | Contenido de una clase. Una clase sin documento se muestra como `no_content`. |
| Versión | `studio.document_version` | Numerada, con estado `draft`, `published` o `archived`. Solo hay un borrador por documento. |
| Diapositiva | `studio.slide` | Tipo, título, fondo, duración, transición y modo de avance. |
| Contenido de la diapositiva | `studio.slide_element`, `studio.narration_clip`, `studio.audio_clip`, `studio.pause`, `studio.slide_comment` | Componentes del catálogo, línea de tiempo y comentarios. |
| Medio | `studio.media_asset` | Archivo de la biblioteca de una categoría. |
| Persona | `studio.app_user` | Correo, estado y rol de cada cuenta. |
| Rol | `studio.role`, `studio.role_permission` | Roles y las acciones de cada uno. |
| Acceso | `studio.access_grant` | Categoría completa o subcategoría de una persona. |

Las personas, los roles y los accesos se cargan a mano: ver [operations/content.md](../operations/content.md).

## Ciclo de una clase

1. La clase nace sin documento y se muestra como `no_content`.
2. `createDocument` crea el documento y la versión 1 en borrador.
3. `publishVersion` publica el borrador, archiva la versión publicada anterior y pide la exportación.
4. `createVersion` crea el siguiente borrador como copia de la versión publicada.

El editor no crea carpetas ni clases. Se administran en la base de datos.

## Migraciones

Las migraciones son archivos `apps/api/db/migrations/NNNN_name.sql`. Una línea con `--;` separa cada sentencia, porque la Data API ejecuta una sentencia por llamada.

En AWS, la Lambda `Migrate` las aplica durante el despliegue de `LumiaStudioDataStack`, en cada despliegue que las cambie. En local se aplican con este comando:

```bash
npm run db:migrate
```

| Archivo | Contenido |
|---|---|
| `0000_bootstrap.sql` | Extensiones, esquema `studio` y rol `studio_app` |
| `0001_tree.sql` | Categorías, subcategorías, carpetas y clases |
| `0002_access.sql` | Personas, roles, acciones y accesos |
| `0003_documents.sql` | Documentos, versiones, diapositivas y comentarios |
| `0004_media_and_timeline.sql` | Medios, componentes, narraciones, pausas y audios |
| `0005_advance_on_complete.sql` | Modo de avance `on_complete` |
| `0006_category_groups.sql` | Grupos de menú (`group_name`) |
| `0007_version_export.sql` | Estado de la exportación de cada versión |

## Buckets

Todos los buckets son `PrivateBucket`: ninguno es público.

| Bucket | Stack | Contenido |
|---|---|---|
| `Media` | `LumiaStudioDataStack` | Medios bajo `media/` y audios de narración bajo `narration/` |
| `Published` | `LumiaStudioDataStack` | Archivos `.lumia` de las clases publicadas. Versionado. |
| `AccessLogs` | `LumiaStudioDataStack` | Logs de acceso de los buckets y logs de la red bajo `vpc-flow-logs/` |
| `Sessions` | `LumiaStudioAgentRuntimeStack` | Conversaciones de Lumi |
| `SessionsLogs` | `LumiaStudioAgentRuntimeStack` | Logs de acceso de `Sessions` |
| `Site` | `LumiaStudioWebStack` | Build de la web y `config.json` |
| `AccessLogs` | `LumiaStudioWebStack` | Logs de CloudFront y de los buckets de la web |

### Medios y narración

- `createMediaUpload` entrega una URL firmada de `PUT` válida por 5 minutos. La web sube el archivo al bucket `Media` y `registerMedia` lo registra.
- Las descargas usan URLs firmadas válidas por una hora.
- `generateNarration` genera el audio con Amazon Polly y lo guarda bajo el prefijo `narration/` del bucket `Media`.

### Publicación

1. `publishVersion` publica el borrador e invoca la Lambda `Export` de forma asíncrona. No espera el resultado.
2. `Export` construye el archivo `.lumia` en memoria: un zip con `definition.json`, medios y audios.
3. `Export` lo guarda en el bucket versionado `Published`, en una ruta que sigue el árbol.
4. El estado queda en `export_status` de `studio.document_version`: `pending`, `ready` o `failed`.

Lambda reintenta dos veces una exportación fallida. Publicar otra vez la clase también la exporta de nuevo. El sandbox no exporta clases.

## Retención de datos

| Recurso | Stack | Al eliminar el stack |
|---|---|---|
| Aurora | `LumiaStudioDataStack` | Deja un snapshot. Tiene protección contra borrado. |
| Buckets `Media`, `Published` y `AccessLogs` | `LumiaStudioDataStack` | Se conservan |
| User pool | `LumiaStudioIdentityStack` | Se conserva. Tiene protección contra borrado. |
| Buckets `Sessions` y `SessionsLogs` | `LumiaStudioAgentRuntimeStack` | Se vacían y se eliminan |
| Buckets `Site` y `AccessLogs` | `LumiaStudioWebStack` | Se vacían y se eliminan |

`LumiaStudioDataStack` y `LumiaStudioIdentityStack` tienen protección de terminación.

Siguiente: [Autenticación](authentication.md)

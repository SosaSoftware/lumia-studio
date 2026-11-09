# API de Studio

La API de Studio es un esquema GraphQL en AWS AppSync con resolvers en Lambda. Un registro único asigna a cada campo su acción de Cedar y su handler, y cada Lambda evalúa los permisos de la persona y después ejecuta el handler. Esta página describe el recorrido de una operación, el registro de campos, los permisos con Cedar y la configuración de `@lumia/api`.

## Recorrido de una operación

1. La web lee `/config.json` al iniciar: `apiUrl`, `authMode`, `lumiUrl` y los ids de Cognito.
2. La web llama a AppSync con el access token de Cognito.
3. AppSync valida el token contra el user pool y solo acepta el cliente web.
4. Un resolver JavaScript común (`APPSYNC_RESOLVER_CODE`) invoca la Lambda del campo. `STUDIO_FIELDS` asigna cada campo a su Lambda.
5. `FieldPipeline` identifica a la persona, lee su acceso de la base de datos y consulta a Cedar. Después ejecuta el handler.
6. Los servicios leen y escriben en Aurora por la Data API con el usuario `studio_app`.

En local, `SandboxServer` ejecuta el mismo `FieldPipeline` y los mismos handlers detrás de `/graphql`.

## Registro de campos

`apps/api/src/graphql/fields.ts` define `STUDIO_FIELDS`. Cada entrada declara su acción de Cedar, su handler y, si opera sobre un registro, el tipo y el argumento que lo identifican (`resource`). `LumiaStudioStack` crea un resolver de AppSync por entrada, sobre la Lambda del handler. El esquema está en `apps/api/src/graphql/schema.graphql`.

| Campo | Tipo | Acción | Handler |
|---|---|---|---|
| `categories`, `me`, `treeNodes` | Query | `documents.view` | `tree` |
| `document`, `version`, `componentCatalog` | Query | `documents.view` | `documents` |
| `mediaLibrary` | Query | `documents.view` | `media` |
| `narrationVoices` | Query | `documents.view` | `narration` |
| `createDocument`, `createVersion` | Mutation | `documents.edit` | `documents` |
| `saveSlide`, `reorderSlides`, `duplicateSlide`, `deleteSlide`, `applySlidesDraft` | Mutation | `documents.edit` | `documents` |
| `saveElement`, `deleteElement` | Mutation | `documents.edit` | `documents` |
| `savePause`, `deletePause`, `saveAudio`, `deleteAudio` | Mutation | `documents.edit` | `documents` |
| `saveComment`, `deleteComment` | Mutation | `documents.edit` | `documents` |
| `createMediaUpload`, `registerMedia` | Mutation | `media.upload` | `media` |
| `generateNarration` | Mutation | `narration.generate` | `narration` |
| `saveNarration`, `deleteNarration` | Mutation | `documents.edit` | `narration` |
| `publishVersion` | Mutation | `documents.publish` | `publish` |

Los errores llegan con `errorType` y un mensaje en español.

| `errorType` | Significado |
|---|---|
| `Unauthorized` | Sesión inválida o acción no permitida |
| `NotFound` | El recurso no existe |
| `ValidationError` | Datos inválidos |
| `Conflict` | El estado actual impide la operación |
| `InternalError` | Error interno |

## Lambdas

| Archivo | Función |
|---|---|
| `apps/api/src/lambda/appsync.ts` | Handlers de AppSync: `documents`, `media`, `narration`, `publish` y `tree` |
| `apps/api/src/lambda/export.ts` | Exporta una versión publicada como `.lumia`. Se invoca de forma asíncrona. |
| `apps/api/src/lambda/migrate.ts` | Aplica las migraciones y asigna la contraseña de `studio_app` |
| `apps/api/src/lambda/pre-token-generation.ts` | Trigger de Cognito que agrega `email` al access token |
| `apps/api/src/mcp/handlers/index.ts` | Handlers de los cuatro targets del Studio MCP |

## Permisos con Cedar

El token solo identifica a la persona. Studio lee su rol, sus acciones y su acceso desde la base de datos, y Cedar decide cada operación. La autorización se ejecuta dentro de cada Lambda con `cedar-wasm`. El sandbox usa el mismo código.

### Pasos de una operación

`FieldPipeline` ejecuta estos pasos en cada campo GraphQL:

1. `tokenIdentity` lee `sub` y `email` del token verificado.
2. `ClaimsResolver` lee rol, acciones y acceso de la base de datos. Guarda el resultado 60 segundos.
3. `FieldAuthorizer` toma la acción del campo desde `STUDIO_FIELDS`.
4. Si el campo opera sobre un registro, `StudioResourceLookup` obtiene su categoría y subcategoría.
5. `RefreshingCedarAuthorizer` evalúa la política del rol. Recarga las políticas cada 60 segundos.
6. Si Cedar permite la operación, se ejecuta el handler.

Un cambio de rol o de acceso se aplica en un minuto, sin volver a iniciar sesión.

### Acciones

| Acción | Permite |
|---|---|
| `documents.view` | Ver el árbol y el contenido de las clases |
| `documents.edit` | Editar el contenido de las clases |
| `documents.publish` | Publicar versiones |
| `media.upload` | Subir medios |
| `narration.generate` | Generar narración |

`studio.role_permission` asigna acciones a cada rol. Cada campo declara su acción en `apps/api/src/graphql/fields.ts`.

### Política de un rol

`PolicyGenerator` genera una política por rol con la misma forma. El rol aporta las acciones, y el acceso de la persona limita los registros.

```cedar
permit (
  principal in Studio::Role::"<role-key>",
  action in [
    Studio::Action::"documents.view"
  ],
  resource
)
when {
  ((resource has category && principal.categories.contains(resource.category)) || !(resource has category)) &&
  ((resource has subcategory && principal.subcategories.contains(resource.subcategory)) || !(resource has subcategory))
};
```

Un registro sin categoría ni subcategoría, como el catálogo de componentes, solo necesita la acción.

El esquema está en `apps/api/cedar/schema.cedarschema.json` y se regenera desde `PERMISSION_CATALOG`:

```bash
npm run cedar:schema -w @lumia/api
```

### Acceso por categoría

| Concesión en `studio.access_grant` | Efecto |
|---|---|
| Categoría | Acceso a la categoría y a todas sus subcategorías |
| Subcategoría | Acceso a esa subcategoría; la categoría que la contiene queda visible |

Los grupos de menú (`group_name`) son solo visuales y no tienen reglas de acceso. La carga de roles y accesos está en [operations/content.md](../operations/content.md).

## Studio MCP

`apps/api/src/mcp` define las herramientas de Lumi en cuatro targets: `studio-read`, `studio-slides`, `studio-elements` y `studio-timeline`. Cada herramienta llama a la API GraphQL con el token de la persona, así que pasa por los mismos permisos. La lista está en [lumi-tools.md](lumi-tools.md). `apps/api/src/mcp/gateway-interceptor.ts` no está conectado a ningún gateway.

## Variables de entorno

| Variable | Propósito |
|---|---|
| `LUMIA_DB_DRIVER` | `pg` por defecto, o `data-api` |
| `LUMIA_DB_NAME` | Nombre de la base de datos |
| `LUMIA_PG_HOST`, `LUMIA_PG_PORT` | Conexión con `pg` |
| `LUMIA_SANDBOX_DB_PASSWORD` | Contraseña de `lumia_admin` con `pg` |
| `LUMIA_DB_STUDIO_APP_PASSWORD` | Contraseña de `studio_app` con `pg` |
| `LUMIA_DB_CLUSTER_ARN`, `LUMIA_DB_SECRET_ARN` | Clúster y secreto con `data-api` |
| `LUMIA_DB_APP_SECRET_ARN` | Secreto de `studio_app`, para la Lambda de migraciones |
| `LUMIA_MIGRATIONS_DIR` | Carpeta de migraciones de esa Lambda |
| `LUMIA_STORAGE_DRIVER` | `filesystem` por defecto, o `s3` |
| `LUMIA_MEDIA_BUCKET` | Bucket de medios con `s3` |
| `LUMIA_STORAGE_ROOT` | Carpeta de archivos con `filesystem` |
| `LUMIA_API_BASE_URL` | URL base de las rutas firmadas con `filesystem` |
| `LUMIA_STORAGE_SIGNING_SECRET` | Secreto de las rutas firmadas con `filesystem` |
| `LUMIA_PUBLISHED_BUCKET` | Bucket de clases publicadas, para la Lambda `Export` |
| `LUMIA_EXPORT_FUNCTION` | Lambda de exportación. Sin ella, las clases publicadas no se exportan. |
| `LUMIA_SPEECH_PROVIDER` | `none` por defecto, o `polly` |
| `STUDIO_GRAPHQL_URL` | Endpoint GraphQL de las herramientas del Studio MCP |

Siguiente: [Datos](data.md)

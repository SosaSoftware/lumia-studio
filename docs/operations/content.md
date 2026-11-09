# Contenido y accesos

El editor no crea carpetas, clases, cuentas, roles ni accesos: se administran en la base de datos y en Cognito. Las migraciones no cargan esos datos, así que un entorno nuevo los necesita después del primer despliegue. Esta página describe el árbol, las cuentas, los roles, los accesos y cómo ejecutar los comandos en AWS.

## Árbol de contenido

El árbol vive en `studio.category`, `studio.subcategory` y `studio.tree_node`. El editor solo edita el contenido de clases existentes.

Para agregar una clase se inserta una fila en `studio.tree_node`:

| Columna | Valor |
|---|---|
| `subcategory_id` | Igual al del padre |
| `parent_id` | Id de la carpeta padre. `null` coloca la clase en la raíz de la subcategoría. |
| `kind` | `class` |
| `name` | Minúsculas, números y guiones, terminado en `.lumia`. Hasta 80 caracteres. |
| `display_name` | Nombre visible, hasta 160 caracteres |
| `position` | Orden entre sus hermanos |

La base rechaza un `name` inválido, dos hermanos con el mismo `name`, un padre de tipo clase y un padre de otra subcategoría.

Una clase nueva aparece como `no_content` hasta que tenga documento. Las personas con acceso a su subcategoría la ven en el árbol.

Una carpeta se crea igual, con `kind` en `folder` y sin el sufijo `.lumia`.

## Cuentas

Una persona necesita datos en Cognito y en la base de datos.

| Paso | Dónde | Dato |
|---|---|---|
| 1 | Cognito | Cuenta creada por un administrador, con el correo de la persona |
| 2 | `studio.app_user` | Fila con el mismo correo, `status` en `active` y `role_id` |
| 3 | `studio.access_grant` | Una fila por categoría completa o por subcategoría |

Sin cuenta activa, sin rol o sin acceso, Studio rechaza la operación aunque el token sea válido. El registro propio está deshabilitado en Cognito: ver [architecture/authentication.md](../architecture/authentication.md).

## Roles

Un rol es una fila de `studio.role` con sus acciones en `studio.role_permission`. Las migraciones no crean roles: en un entorno nuevo, `studio.role` y `studio.role_permission` se cargan a mano.

El sandbox define tres roles en `sandbox/seed/seed-data.ts`:

| `key` | Nombre | Acciones |
|---|---|---|
| `admin` | Administración | Todas las de `PERMISSION_CATALOG` |
| `content_creator` | Creación de contenido | `documents.view`, `documents.edit`, `documents.publish`, `media.upload` y `narration.generate` |
| `viewer` | Lectura | `documents.view` |

Las acciones disponibles están en [architecture/api.md](../architecture/api.md). Un cambio de rol se aplica en un minuto, sin volver a iniciar sesión.

## Accesos

| Concesión en `studio.access_grant` | Efecto |
|---|---|
| Categoría | Acceso a la categoría y a todas sus subcategorías |
| Subcategoría | Acceso a esa subcategoría; la categoría que la contiene queda visible |

Cada fila tiene una categoría o una subcategoría, nunca ambas. Los grupos de menú (`group_name`) son solo visuales y no tienen reglas de acceso.

## Ejecutar en AWS

En AWS se ejecuta con RDS Data API, usando el secreto por su ARN y sin leer su valor. Los dos ARN son salidas de `LumiaStudioDataStack`.

| Marcador | Salida |
|---|---|
| `<cluster-arn>` | `DatabaseClusterArn` |
| `<secret-arn>` | `DatabaseAdminSecretArn` |

Para agregar una clase:

```bash
aws rds-data execute-statement \
  --region <region> \
  --resource-arn <cluster-arn> \
  --secret-arn <secret-arn> \
  --database lumia_studio \
  --sql "insert into studio.tree_node (subcategory_id, parent_id, kind, name, display_name, position) values ('<subcategory-id>', '<parent-id>', 'class', '<class-name>.lumia', '<display-name>', <position>)"
```

Para ver los nodos de una subcategoría:

```bash
aws rds-data execute-statement \
  --region <region> \
  --resource-arn <cluster-arn> \
  --secret-arn <secret-arn> \
  --database lumia_studio \
  --sql "select id, parent_id, kind, name, display_name, position from studio.tree_node where subcategory_id = '<subcategory-id>' order by position"
```

Si la base está en pausa, la Data API responde `DatabaseResumingException`. Se repite el comando después de unos segundos.

Siguiente: [Solución de problemas](troubleshooting.md)

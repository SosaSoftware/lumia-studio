# Autenticación

El token de Cognito solo identifica a la persona. Studio lee su rol, sus acciones y su acceso desde la base de datos, y Cedar decide cada operación. Lumi no tiene permisos propios: usa el token de la persona que lo invoca. Esta página describe Cognito, los gateways, el recorrido del token, los permisos y la autenticación local.

## Cognito

`LumiaStudioIdentityStack` crea el user pool y el cliente de la web.

| Ajuste | Valor |
|---|---|
| Plan | `ESSENTIALS`, necesario para agregar claims al access token |
| Registro propio | Deshabilitado: un administrador crea cada cuenta |
| Inicio de sesión | Correo, sin distinguir mayúsculas |
| Contraseña | Mínimo 12 caracteres, con mayúsculas, minúsculas, números y símbolos |
| Contraseña temporal | Válida por 7 días; el primer inicio pide una nueva |
| Recuperación | Solo por correo |
| Cliente `Web` | Sin secreto, flujo SRP, sin OAuth |
| Access token e ID token | 1 hora |
| Refresh token | 7 días |
| Protección contra borrado | Activa |
| MFA | No requerido; la pantalla de inicio de sesión no tiene ese paso |

La Lambda `PreTokenGeneration` (`apps/api/src/lambda/pre-token-generation.ts`) agrega el claim `email` al access token. No lee la base de datos: Cognito espera 5 segundos como máximo y la base puede estar en pausa.

## Gateways y runtime

| Componente | Nombre | Autorizador | Función |
|---|---|---|---|
| Gateway de entrada | `lumia-lumi-entry` | `CUSTOM_JWT` con `allowedClients` | Gateway HTTP público. Valida el token y lo reenvía con `JWT_PASSTHROUGH` al runtime. |
| Runtime | `lumia_lumi` | JWT con `allowedClients` | Valida el token otra vez y lo entrega al contenedor. |
| Gateway MCP | `lumia-studio-tools` | `CUSTOM_JWT` con `allowedClients` | Valida el token y expone las herramientas de Studio. Invoca las Lambdas con su propio rol (`GATEWAY_IAM_ROLE`). |

Los tres validan contra el user pool de Studio y solo aceptan el cliente web.

El runtime no define `allowedAudience` porque el access token de Cognito no trae `aud`. `Authorization` está en `requestHeaderAllowlist` para que llegue al contenedor.

## Recorrido del token

1. La web inicia sesión con SRP por Amplify y obtiene el access token.
2. Para GraphQL, la web envía el token en `authorization`. AppSync lo valida y solo acepta el cliente web.
3. Para Lumi, la web envía `Authorization: Bearer <token>` a `lumia-lumi-entry`, junto con `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id`.
4. `lumia-lumi-entry` valida el token y lo reenvía con `JWT_PASSTHROUGH`.
5. El runtime valida el token y lo pasa al contenedor.
6. `AgentCoreTokenReader` decodifica el token sin verificar la firma, porque el runtime ya la verificó. Comprueba `sub` y `exp` para fallar de forma segura si el runtime quedara mal configurado.
7. `StudioMcpConnector` envía el token a `lumia-studio-tools` en dos encabezados.
8. El gateway valida `Authorization` y propaga `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken` a la Lambda. Ese encabezado está en `allowedRequestHeaders` de cada target.
9. La Lambda lee el token del encabezado propagado y llama a AppSync con él.
10. Studio resuelve a la persona y aplica sus permisos.

El token nunca entra en los argumentos de una herramienta, así que el modelo no lo ve. Lumi tampoco lo escribe en sus logs.

`apps/api/src/mcp/gateway-interceptor.ts` no está conectado a ningún gateway y no forma parte del flujo. El token llega a la Lambda porque Lumi lo envía en el encabezado propagado.

| Encabezado | Tramo | Función |
|---|---|---|
| `authorization` | Web y herramientas hacia AppSync | Token sin el prefijo `Bearer` |
| `Authorization` | Web hacia `lumia-lumi-entry`; Lumi hacia `lumia-studio-tools` | `Bearer <token>`. Lo valida cada gateway. |
| `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken` | Lumi hacia `lumia-studio-tools` y de ahí a la Lambda | Lleva el token a la herramienta. |
| `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` | Web hacia Lumi | Mantiene cada conversación en una sesión del runtime. |

## Permisos

Un token válido no basta. Para operar, una persona necesita una cuenta en Cognito, una fila activa con rol en `studio.app_user` y al menos un acceso en `studio.access_grant`. Sin cuenta activa, sin rol o sin acceso, Studio rechaza la operación. La carga de esos datos está en [operations/content.md](../operations/content.md).

Cedar evalúa cada operación dentro de la Lambda del campo. Los pasos, las acciones y la forma de la política están en [api.md](api.md).

Dentro de Lumi hay dos controles:

1. `StudioMcpConnector` llama a `get_my_access` y oculta al modelo las herramientas que la persona no puede usar. Si la persona no puede ni leer, Lumi conversa sin herramientas de Studio.
2. Studio autoriza cada llamada con Cedar, aunque la herramienta sea visible.

El consentimiento de la persona es un control aparte. Ver [lumi.md](lumi.md).

## Autenticación local

El sandbox reemplaza a Cognito con `POST /dev/login`. Cualquier cuenta activa entra con su correo y la contraseña no se revisa. El token es un JWT HS256 válido por 8 horas, firmado con `LUMIA_DEV_JWT_SECRET`. Solo identifica a la persona, igual que el de Cognito. El login de desarrollo existe solo en el servidor local.

| Pieza | AWS | Sandbox |
|---|---|---|
| Inicio de sesión en la web | `CognitoAuthProvider` | `DevAuthProvider` |
| Validación en la API | AppSync | `DevJwtVerifier` |
| Identidad en Lumi | `AgentCoreTokenReader` | `DevTokenVerifier` |
| Gateway MCP | `lumia-studio-tools` | `McpGatewayEmulator` |

`authMode` de `config.json` elige el proveedor de la web:

| `authMode` | Proveedor | Comportamiento |
|---|---|---|
| `dev` | `DevAuthProvider` | Login del sandbox, sin revisar la contraseña. El token vive en `sessionStorage`. |
| `cognito` | `CognitoAuthProvider` | User pool de Cognito con Amplify y SRP. Amplify se carga en el primer uso. |

Siguiente: [Lumi](lumi.md)

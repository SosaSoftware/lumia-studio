# Referencia de Lumi

Contrato HTTP del contenedor de Lumi, límites, archivos que lo definen, recursos de AWS y variables de entorno. Se consulta al integrar con Lumi, al diagnosticar una respuesta o al configurar un entorno.

## Contrato HTTP

| Ruta | Contrato |
|---|---|
| `POST /invocations` | `RunAgentInput` de AG-UI en JSON, con `Authorization: Bearer <token>`. Emite eventos AG-UI por SSE, o en protobuf si `Accept` pide `application/vnd.ag-ui.event+proto`. |
| `GET /ping` | `{"status":"Healthy"}`, o `HealthyBusy` mientras corre un turno. |

Los errores anteriores al inicio del stream son JSON `{ "error": { "code", "message" } }`.

| Estado | Causa |
|---|---|
| 400 | Entrada, JSON o id de conversación inválidos |
| 401 | Token ausente, inválido o rechazado |
| 404 | Ruta inexistente |
| 413 | Cuerpo o mensaje demasiado grande |
| 415 | El cuerpo no es JSON |
| 500 | Error no controlado |
| 503 | Studio no está disponible, o no hay espacio para otra conversación |

Un turno que falla durante el stream termina con `RUN_ERROR`. El navegador recibe el código y un mensaje genérico. El texto del error queda en el log, porque puede nombrar cuentas o roles de AWS. El mensaje siguiente funciona, porque un turno sin respuesta se cierra al llegar el siguiente.

## Límites

| Límite | Valor | Definido en |
|---|---|---|
| Rondas de herramientas de pantalla por mensaje | 8 | `MAX_ROUNDS` en `apps/web/src/features/lumi/lumi-session.ts` |
| Cambios por confirmación | 20 | `policies/confirmation.json` |
| Tamaño del cuerpo de una petición | 10 MB | `BODY_LIMIT` en `agui-server.ts` |
| Caracteres de un mensaje | 50 000 | `DEFAULT_LIMITS` en `input-guard.ts` |
| Caracteres de una respuesta de herramienta | 20 000 | `DEFAULT_LIMITS` en `input-guard.ts` |
| Herramientas declaradas por petición | 32 | `DEFAULT_LIMITS` en `input-guard.ts` |
| Entradas del contexto de pantalla | 16, de hasta 600 caracteres | `DEFAULT_LIMITS` en `screen-context.ts` |
| Conversaciones en memoria | 100 | `MAX_THREADS` en `lumi-runtime.ts` |
| Sesión inactiva del runtime | 2 horas | `IDLE_SESSION_TIMEOUT` en `lumia-studio-agent-runtime-stack.ts` |

## Archivos de definición

Estos archivos definen a Lumi. Se leen una vez al iniciar, y un archivo inválido detiene el arranque.

| Ruta en `apps/agent` | Contenido |
|---|---|
| `src/prompts/lumi.md` | Instrucciones, agregadas después del contrato del harness |
| `src/prompts/preference-extraction.md` | Qué cuenta como preferencia duradera |
| `skills/<name>/SKILL.md` | Skills de cocreación, cargadas bajo demanda. El `name` debe coincidir con la carpeta. |
| `policies/confirmation.json` | Reglas de consentimiento: herramienta de confirmación, targets de solo lectura y máximo de cambios por confirmación |

## Recursos en AWS

| Recurso | Stack | Configuración |
|---|---|---|
| AgentCore Runtime `lumia_lumi` | `LumiaStudioAgentRuntimeStack` | Protocolo AG-UI y JWT con `allowedClients`. `Authorization` está en `requestHeaderAllowlist` para que llegue al contenedor. |
| Rol del runtime | `LumiaStudioAgentRuntimeStack` | `bedrock:InvokeModel` y `bedrock:InvokeModelWithResponseStream`, y lectura y escritura en el bucket `Sessions`. |
| Bucket `Sessions` | `LumiaStudioAgentRuntimeStack` | Conversaciones, por `LUMI_SESSION_BUCKET`. |
| Gateway MCP `lumia-studio-tools` | `LumiaStudioAgentStack` | `CUSTOM_JWT` y `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken` en `allowedRequestHeaders` de cada target. |
| Gateway de entrada `lumia-lumi-entry` | `LumiaStudioAgentStack` | `CUSTOM_JWT` y `JWT_PASSTHROUGH` hacia el runtime. |

La web envía `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` con el id de la conversación, así cada conversación queda en una sesión del runtime. Las trazas se activan con `OTEL_TRACES_EXPORTER=otlp`. La imagen y su despliegue están en [operations/deployment.md](../operations/deployment.md).

## Variables de entorno

`@lumia/packages/lumi-env` valida las variables al iniciar. Un valor vacío cuenta como no definido.

| Variable | Por defecto | Propósito |
|---|---|---|
| `AWS_REGION` | Requerida | Región de Bedrock, S3 y AgentCore Memory |
| `LUMI_MCP_URL` | Requerida | Endpoint MCP: URL de AgentCore Gateway, o el emulador en local |
| `LUMI_MCP_TOKEN_HEADER` | `X-Amzn-Bedrock-AgentCore-Runtime-Custom-StudioToken` | Encabezado que lleva el token de la persona a las herramientas |
| `LUMI_SESSION_BUCKET` | Ninguno | Bucket de conversaciones. Se define esta o `LUMI_SESSION_DIR`, no ambas. El runtime usa esta. |
| `LUMI_SESSION_PREFIX` | `sessions` | Prefijo de conversaciones en S3 |
| `LUMI_SESSION_DIR` | Ninguno | Directorio de conversaciones, en local |
| `LUMI_MEMORY_DIR` | Ninguno | Directorio de preferencias. Se define esta o `LUMI_MEMORY_ID`, no ambas. El runtime usa esta. |
| `LUMI_MEMORY_ID` | Ninguno | Preferencias en AgentCore Memory. El runtime no la define. |
| `LUMI_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` | Modelo o perfil de inferencia de Bedrock |
| `LUMI_MODEL_TEMPERATURE` | `0.2` | Temperatura; `none` deja la del modelo |
| `LUMI_MODEL_MAX_TOKENS` | `16384` | Límite de salida por llamada al modelo |
| `LUMI_GUARDRAIL_ID`, `LUMI_GUARDRAIL_VERSION` | Ninguno | Guardrail de Bedrock. Se definen ambas o ninguna. |
| `BEDROCK_API_KEY` | Ninguno | Llave de API de Bedrock. Sin ella se usa la cadena de credenciales de AWS. Se define en el entorno del shell, nunca en `.env`. |
| `LUMI_PORT` | `8080` | Puerto de escucha |
| `LUMI_BIND_HOST` | `127.0.0.1` | Dirección de escucha. La imagen usa `0.0.0.0`. |
| `LUMI_THREAD_IDLE_MINUTES` | `30` | Minutos sin uso hasta sacar de memoria una conversación. Sigue en almacenamiento. |
| `LUMI_LOG_LEVEL` | `info` | `debug`, `info`, `warn` o `error`. Los logs son líneas JSON. |
| `LUMIA_DEV_JWT_SECRET` | Ninguno | Secreto de los tokens del sandbox. Solo lo usa el punto de entrada local. |

Siguiente: [Desarrollo](../development/README.md)

# Diagnóstico

Guía para encontrar los logs, interpretar los síntomas y mensajes más frecuentes y conocer las limitaciones de Lumia Studio y Lumi. Se empieza por la tabla de logs y se baja al síntoma concreto.

## Logs

| Origen | Ubicación | Retención |
|---|---|---|
| Lumi en AWS | Grupo de CloudWatch `/aws/bedrock-agentcore/runtimes/<runtime-id>-DEFAULT` | Sin retención definida en CDK |
| Lambdas | Grupo propio de cada función | Un mes |
| AppSync | Grupo de la API. Solo errores y sin contenido detallado, para no escribir el token. | Un mes |
| CloudFront y S3 | Buckets `AccessLogs` | 90 días; 30 días en `SessionsLogs` |
| Red de la base de datos | Bucket `AccessLogs` de `LumiaStudioDataStack`, prefijo `vpc-flow-logs/` | 90 días |
| Servicios locales | `.sandbox/<service>.log` | Sin límite |

En local, el log de un servicio se sigue con este comando:

```bash
npm run dev:logs lumi
```

### Logs de Lumi

Lumi escribe una línea JSON por evento, con `time`, `level`, `message` y campos adicionales. `LUMI_LOG_LEVEL` define el nivel mínimo. Los errores incluyen `name`, `message`, `stack` y la cadena `cause`.

Lumi no escribe a propósito tokens, prompts, mensajes ni argumentos de herramientas. Los errores se registran tal como los genera cada librería, por lo que conviene revisar su contenido al compartir un log.

| Síntoma o mensaje | Significado |
|---|---|
| `Received error (401) from runtime` | El contenedor respondió 401. Si aparece `Studio rejected the session`, lo rechazó el gateway MCP o Studio. |
| `Received error (500) from runtime` | Error no controlado en el contenedor. Revisar `Request failed` y su `cause`. |
| `Change held back` con `no matching consent` | Un cambio no tiene una confirmación válida con esos argumentos. |
| `Change held back` con `declined in this turn` | La persona rechazó un cambio en este turno. |
| `Confirmation ignored: invalid request` | `confirm_change` llegó sin el formato esperado. |
| `Change approved by the person` | El cambio pasó el control de consentimiento. |
| `tool result JSON parse failed` | Aviso sin impacto: el resultado de una herramienta es texto. |
| Muchas líneas `Lumi is listening` sin peticiones | Inicio de instancias del runtime. No indica un problema. |

Los códigos HTTP del contenedor están en [architecture/lumi-reference.md](../architecture/lumi-reference.md).

## Mensajes del panel de Lumi

| Mensaje en la web | Causa |
|---|---|
| Tu sesión venció | Lumi respondió 401, o no hay sesión activa |
| Esta conversación pertenece a otra persona | Respuesta 403 |
| Lumi todavía está preparando la conversación | Respuesta 409 después de agotar tres reintentos. AgentCore la devuelve mientras crea la sesión. |
| No se pudo conectar con Lumi | Fallo de red, respuesta 502 o superior, o Lumi sin configurar |

## Base de datos en pausa

Aurora se pausa sin conexiones y reanudar toma unos 15 segundos. Con la base en pausa, RDS Data API responde `DatabaseResumingException`; se repite el comando después de unos segundos. Las Lambdas de resolvers tienen un tiempo límite de 30 segundos, igual que la espera de AppSync.

## Cambiar el autorizador de un gateway

AgentCore rechaza cambiar el tipo de autorizador de un gateway existente, con este error:

```text
Authorizer type cannot be updated for an existing gateway
```

CloudFormation lo documenta como una actualización sin interrupción, pero el servicio lo rechaza. Cambiarlo exige un gateway nuevo.

1. Cambiar el `name` del gateway en `lib/constructs/lumi/studio-mcp-gateway.ts`, y el id del construct `StudioMcpGateway` (`StudioTools`) en `lib/stacks/lumia-studio-agent-stack.ts`. El id nuevo genera ids lógicos nuevos, y CloudFormation crea el gateway nuevo y después borra el anterior.
2. Desplegar `LumiaStudioAgentStack` con `LUMIA_LUMI_RUNTIME_ARN` definida.
3. Desplegar `LumiaStudioAgentRuntimeStack`, porque cambió la URL del gateway MCP.

## Desborde de contenido en diapositivas

`SlideLayoutEngine.place` reduce la altura de las cajas para que quepan en la diapositiva, pero el contenido se dimensiona según el ancho (`cqw`). Si hay demasiados componentes, las cajas no se solapan, pero el contenido sí se desborda.

Con título, cabe una pregunta `multiple_choice` por diapositiva. Solicitar una pregunta por diapositiva evita el problema.

## Limitaciones conocidas

| Limitación | Detalle |
|---|---|
| Rondas de Lumi | La web permite como máximo 8 rondas de herramientas de pantalla por mensaje (`MAX_ROUNDS`). |
| Preferencias de Lumi | En AWS viven en `/tmp/lumi-memory`, en el almacenamiento de escritura del contenedor. |
| Target `knowledge` | Lumi lo reconoce, pero la infraestructura no lo crea. |
| Exportación local | El sandbox no genera archivos `.lumia`. |
| `LUMIA_LUMI_URL` relativa | `deploy-config.ts` la acepta, pero CloudFront no tiene una ruta hacia Lumi. |
| MFA | El user pool no lo requiere y la pantalla de inicio de sesión no tiene ese paso. |
| Rotación de secretos | Los secretos de la base de datos no rotan. |
| WAF y dominio | CloudFront no usa AWS WAF y sirve el dominio `cloudfront.net` con su certificado por defecto. |
| Pruebas end-to-end | `apps/web/e2e`, la carpeta que busca Playwright, no existe en el repositorio. |

Siguiente: [Índice de la documentación](../README.md)

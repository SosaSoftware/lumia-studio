# Diagramas

Diagramas de Lumia Studio y de Lumi en SVG. Los de arquitectura usan los íconos oficiales de [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/); los del modelo de datos dibujan tablas. GitHub y Bitbucket los muestran como imagen dentro de la documentación.

| Diagrama | Contenido | Página que lo usa |
|---|---|---|
| [aws-architecture.svg](aws-architecture.svg) | Servicios de AWS y sus conexiones | [architecture/README.md](../architecture/README.md) |
| [lumi-message-flow.svg](lumi-message-flow.svg) | Recorrido de un mensaje a Lumi, en 12 pasos | [architecture/lumi.md](../architecture/lumi.md) |
| [lumi-change-flow.svg](lumi-change-flow.svg) | Recorrido de un cambio con consentimiento, en 12 pasos | [architecture/lumi.md](../architecture/lumi.md) |
| [deployment-stacks.svg](deployment-stacks.svg) | Stacks de AWS CDK, dependencias y pasadas del despliegue | [operations/deployment.md](../operations/deployment.md) |
| [er-tree-access.svg](er-tree-access.svg) | Tablas del árbol de contenido y del acceso, con sus relaciones | [architecture/data.md](../architecture/data.md) |
| [er-content.svg](er-content.svg) | Tablas del contenido de las clases, con sus relaciones | [architecture/data.md](../architecture/data.md) |

Los diagramas se mantienen al día con la arquitectura. Cada archivo explica su estructura en un comentario al inicio. Los pasos numerados se listan en la página que usa el diagrama, con la misma numeración. Los diagramas del modelo de datos no llevan pasos.

export const errors = {
  saveFailed: 'No se pudo guardar el cambio.',
  noClassOpen: 'No hay una clase abierta.',
  slidesChanged: 'Las diapositivas cambiaron desde otra pestaña o por Lumi. Se actualizó la lista; vuelve a mover la diapositiva.',
  componentMissing: 'el componente no existe en el catálogo.',
  slideGone: 'La diapositiva ya no existe.',
  scriptRequired: 'Escribe lo que dirá la voz antes de generarla.',
  voiceRequired: 'Elige una voz de Polly antes de generar la narración.',
  noDraftVersion: 'La clase no tiene una versión en borrador.',
  demoDownload: 'No se pudo descargar la demo ({status}).',
  uploadFailed: 'No se pudo subir el archivo.',
  appNotInitialized: 'La aplicación no está inicializada.',
  network: 'No se pudo conectar con el servidor.',
  sessionEnded: 'Tu sesión terminó. Inicia sesión de nuevo.',
  invalidResponse: 'La respuesta del servidor no es válida.',
  noData: 'La respuesta del servidor no trae datos.',
  generic: 'Ocurrió un error.',
};

export const config = {
  notObject: 'config.json no es un objeto.',
  missingApiUrl: 'config.json: falta "apiUrl".',
  badAuthMode: 'config.json: "authMode" debe ser dev o cognito.',
  missingCognito: 'config.json: con authMode cognito faltan "cognito.userPoolId" y "cognito.userPoolClientId".',
  unreadable: 'No se pudo leer config.json.',
};

export const notices = {
  versionCreated: 'Se creó la versión {number} en borrador.',
  versionPublished: 'La versión {number} está publicada.',
};

export const app = {
  startFailed: 'No se pudo iniciar Lumia Studio.',
};

export const common = {
  close: 'Cerrar',
  cancel: 'Cancelar',
  retry: 'Reintentar',
  needClass: '{name} · Abre una clase para usarlo',
  hide: 'Ocultar',
  name: 'Nombre',
  type: 'Tipo',
  effect: 'Efecto',
  duration: 'Duración',
  durationSeconds: 'Duración en segundos',
  startsAt: 'Empieza en',
  startsAtSecond: 'Empieza en el segundo',
  time: 'Tiempo',
  add: 'Agregar',
  remove: 'Quitar',
  yes: 'Sí',
  no: 'No',
  chooseFromLibrary: 'Elegir de la biblioteca',
};

import type { app as esApp, common as esCommon, config as esConfig, errors as esErrors, notices as esNotices } from '../es/errors.ts';

export const errors: typeof esErrors = {
  saveFailed: 'The change could not be saved.',
  noClassOpen: 'There is no open class.',
  slideTypeMissing: 'the slide type does not exist.',
  slidesChanged: 'The slides changed from another tab or by Lumi. The list was updated; move the slide again.',
  componentMissing: 'the component does not exist in the catalog.',
  slideGone: 'The slide no longer exists.',
  scriptRequired: 'Write what the voice will say before generating it.',
  voiceRequired: 'Choose a Polly voice before generating the narration.',
  noDraftVersion: 'The class has no draft version.',
  demoDownload: 'The demo could not be downloaded ({status}).',
  uploadFailed: 'The file could not be uploaded.',
  appNotInitialized: 'The application is not initialized.',
  network: 'Could not connect to the server.',
  sessionEnded: 'Your session ended. Sign in again.',
  invalidResponse: 'The server response is not valid.',
  noData: 'The server response has no data.',
  generic: 'An error occurred.',
};

export const config: typeof esConfig = {
  notObject: 'config.json is not an object.',
  missingApiUrl: 'config.json: "apiUrl" is missing.',
  badAuthMode: 'config.json: "authMode" must be dev or cognito.',
  missingCognito: 'config.json: with authMode cognito, "cognito.userPoolId" and "cognito.userPoolClientId" are missing.',
  unreadable: 'config.json could not be read.',
};

export const notices: typeof esNotices = {
  versionCreated: 'Version {number} was created as a draft.',
  versionPublished: 'Version {number} is published.',
};

export const app: typeof esApp = {
  startFailed: 'Lumia Studio could not start.',
};

export const common: typeof esCommon = {
  close: 'Close',
  cancel: 'Cancel',
  retry: 'Retry',
  needClass: '{name} · Open a class to use it',
  hide: 'Hide',
  name: 'Name',
  type: 'Type',
  effect: 'Effect',
  duration: 'Duration',
  durationSeconds: 'Duration in seconds',
  startsAt: 'Starts at',
  startsAtSecond: 'Starts at second',
  time: 'Time',
  add: 'Add',
  remove: 'Remove',
  yes: 'Yes',
  no: 'No',
  chooseFromLibrary: 'Choose from the library',
};

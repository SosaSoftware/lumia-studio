import type { auth as esAuth, demo as esDemo } from '../es/auth.ts';

export const auth: typeof esAuth = {
  signIn: {
    kicker: 'Content platform',
    headline: 'Create the content of your classes',
    pitch: 'The workspace where every class becomes interactive content, with Lumi by your side.',
    points: {
      tree: { title: 'Everything in a tree', text: 'Every class in its folder, ready to create its content' },
      lumi: { title: 'Lumi by your side', text: 'It helps you create and review the content' },
      dynamic: { title: 'Dynamic content', text: 'Create dynamic classes for students' },
    },
    title: 'Sign in',
    subtitle: 'Sign in with your Lumia Studio account.',
    noAccess: 'Your account does not have access to Lumia Studio. Ask an administrator to enable your access.',
    submit: 'Sign in',
    footer: 'Lumia Studio · Content platform',
    devHint: 'Sandbox: enter the email of an active account; the password is not checked.',
    hint: 'Use the email and password of your Lumia Studio account.',
    newPasswordTitle: 'Create your password',
    newPasswordHint: 'This is your first sign-in. Choose a password of at least 12 characters, with uppercase letters, lowercase letters, numbers and symbols.',
    email: 'Email',
    password: 'Password',
    newPassword: 'New password',
    repeatPassword: 'Repeat the password',
    soon: 'Coming soon',
    forgot: 'Forgot your password?',
    cancel: 'Cancel',
    saveAndEnter: 'Save and sign in',
    mismatch: 'The passwords do not match.',
  },
  errors: {
    signInFailed: 'Could not sign in.',
    badCredentials: 'The email or the password is not correct.',
    invalidNewPassword: 'The new password does not meet the requirements: at least 12 characters, with uppercase letters, lowercase letters, numbers and symbols.',
    passwordReset: 'Your password was reset. Ask an administrator for a new temporary password.',
    tooManyAttempts: 'There were too many attempts. Wait a few minutes and try again.',
    network: 'Could not connect to the server. Try again.',
    newPasswordRequired: 'This is your first sign-in: choose a new password.',
    unsupportedStep: 'Your account requires a sign-in step that Lumia Studio does not support yet. Ask an administrator for help.',
    invalidResponse: 'The sign-in response is not valid.',
    noTemporaryPasswords: 'The sandbox does not use temporary passwords.',
  },
};

export const demo: typeof esDemo = {
  unavailable: 'The demo is not available yet.',
  loadFailed: 'The demo could not be loaded.',
  loading: 'Loading the demo',
  missingDefinition: 'The .lumia file has no definition.json.',
  invalidDefinition: 'The definition.json of the .lumia file is not valid JSON.',
  wrongVersion: 'The file is not a .lumia of version {version}.',
  invalidFile: 'The file is not a valid .lumia.',
};

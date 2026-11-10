import type { shell as esShell } from '../es/shell.ts';

export const shell: typeof esShell = {
  sidebar: {
    label: 'Panels and preferences',
    properties: 'Properties',
    propertiesDisabled: 'Properties · Select an item in the tree or open a class',
    comments: 'Comments',
    bottomPanel: 'Bottom panel',
    slides: 'Slides',
    timeline: 'Timeline',
    themeToNight: 'Switch to night mode',
    themeToDay: 'Switch to day mode',
    language: 'Language',
    languageCurrent: 'Language: {name}',
  },
  activity: {
    label: 'Tools',
    explorer: 'Explorer',
    groups: 'Component groups',
    settings: 'Settings',
    settingsSoon: 'Settings · Coming soon',
  },
  topBar: {
    category: 'Category',
    categoryCurrent: 'Category: {name}',
    subcategory: 'Subcategory',
    subcategoryCurrent: 'Subcategory: {name}',
    openClass: 'Open class: {name}',
    preview: 'Preview',
    publish: 'Publish',
    account: 'Account',
    accountOf: 'Account of {name}',
    signOut: 'Sign out',
  },
  statusBar: {
    route: 'Path',
    saving: 'Saving…',
    slideOf: 'Slide {position} of {total}',
  },
  toasts: {
    dismiss: 'Dismiss the notice',
  },
};

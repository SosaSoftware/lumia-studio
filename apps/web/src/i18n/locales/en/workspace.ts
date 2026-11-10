import type { workspace as esWorkspace } from '../es/workspace.ts';

export const workspace: typeof esWorkspace = {
  status: {
    no_content: 'No content',
    draft: 'Draft',
    published: 'Published',
  },
  version: {
    draft: 'Version {number} (draft)',
    draftWithPublished: 'Version {number} (draft) · version {published} is published',
    published: 'Version {number} published',
  },
  previewTip: {
    ready: 'View the class as students will see it',
    noClass: 'Open a class to preview it',
    noContent: 'The class has no content yet',
  },
  publishTip: {
    ready: 'Publish version {number}',
    noClass: 'Open a class to publish it',
    noPermission: 'You do not have permission to publish',
    nothingToPublish: 'There are no changes to publish',
    noContent: 'The class has no content yet',
  },
  tabs: {
    label: 'Open classes',
    unpublishedDraft: 'Unpublished draft',
    closeTab: 'Close {name}',
  },
  page: {
    editor: 'Editor',
    loading: 'Loading the class…',
    emptyTitle: '{name} has no content yet',
    emptyHint: 'Add the first blank slide here or from the Slides group in the bar on the left.',
    addBlank: 'Add a blank slide',
    addSlide: 'Add slide',
    noPermissionEditClass: 'You do not have permission to edit the class',
    openClass: 'Open a class',
    openClassHow: 'Double-click in the tree',
    toggleExplorer: 'Show or hide the explorer',
    askLumi: 'Ask Lumi for help',
  },
};

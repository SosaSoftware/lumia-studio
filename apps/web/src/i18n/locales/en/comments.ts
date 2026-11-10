import type { comments as esComments, preview as esPreview } from '../es/comments.ts';

export const comments: typeof esComments = {
  title: 'Comments',
  hide: 'Hide comments',
  emptySlide: 'Select a slide to see its comments.',
  viewing: 'You are viewing slide {position} of {total}: {title}',
  listTitle: 'Comments on slide {position}',
  none: 'There are no comments on this slide yet.',
  deleteMine: 'Delete my comment',
  delete: 'Delete',
  write: 'Write a comment',
  placeholder: 'Write notes, to-dos or suggestions for this slide…',
  hiddenFromStudents: 'Students do not see these comments.',
  saving: 'Saving…',
  send: 'Comment',
};

export const preview: typeof esPreview = {
  dialogLabel: 'Class preview',
  embeddedLabel: 'Class content',
  badge: 'Preview · this is how students will see it',
  closeLabel: 'Close the preview (Esc)',
  closeShort: 'Close (Esc)',
  blocked: 'Answer the questions to continue',
  blockedHint: 'Answer the questions to continue.',
  end: 'End of the class',
};

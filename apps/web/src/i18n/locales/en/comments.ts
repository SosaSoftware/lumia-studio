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
  waitActivities: 'Complete the activities to continue',
  waitTime: 'Wait until the time is up to continue',
  waitButton: 'Use the «{label}» button to continue',
  waitStart: 'Press «{label}» to begin',
  pauseNext: 'Press Next to continue',
  finish: 'Finish the class',
  end: 'End of the class',
};

import type { media as esMedia } from '../es/media.ts';

export const media: typeof esMedia = {
  title: 'Media library',
  selectHint: 'Choose a file or upload a new one.',
  browseHint: 'Images, audio and video you can use in your classes.',
  filterLabel: 'Media type',
  filters: { all: 'All', image: 'Images', audio: 'Audio', video: 'Video', documents: 'Documents' },
  uploading: 'Uploading…',
  upload: 'Upload file',
  loading: 'Loading…',
  empty: 'There is no media yet.',
  emptyOfType: 'There is no media of this type yet.',
  choose: 'Choose {name}',
  unsupported: 'That file type cannot be uploaded. Use images, audio, video or PDF.',
  tooBig: 'The file is larger than {mb} MB, the limit for {kind}.',
  kinds: { image: 'images', audio: 'audio', video: 'video', pdf: 'PDF' },
};

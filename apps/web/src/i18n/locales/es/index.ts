import type { MessageTree } from '../../types.ts';
import { auth, demo } from './auth.ts';
import { catalog } from './catalog.ts';
import { comments, preview } from './comments.ts';
import { colors, editor } from './editor.ts';
import { app, common, config, errors, notices } from './errors.ts';
import { lumi } from './lumi.ts';
import { media } from './media.ts';
import { palette } from './palette.ts';
import { properties } from './properties.ts';
import { shell } from './shell.ts';
import { slides } from './slides.ts';
import { timeline } from './timeline.ts';
import { tree } from './tree.ts';
import { workspace } from './workspace.ts';

/** Spanish dictionary: the reference of every language, so a key missing in another one does not compile. */
export const es = {
  app,
  auth,
  catalog,
  colors,
  comments,
  common,
  config,
  demo,
  editor,
  errors,
  lumi,
  media,
  notices,
  palette,
  preview,
  properties,
  shell,
  slides,
  timeline,
  tree,
  workspace,
} satisfies MessageTree;

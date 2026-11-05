import { z } from 'zod';
import { ComponentCatalog } from './component-catalog.ts';
import type { ComponentDefinition } from './component-definition.ts';
import {
  accordionComponent,
  buttonLinkComponent,
  flipCardComponent,
  galleryComponent,
  hotspotComponent,
  tabsComponent,
  timelineComponentDef,
  timerComponent,
} from './components/interactive-components.ts';
import { audioComponent, iconComponent, illustrationComponent, imageComponent, videoComponent } from './components/media-components.ts';
import {
  dragDropComponent,
  fillBlankComponent,
  matchingComponent,
  multipleChoiceComponent,
  orderingComponent,
  trueFalseComponent,
} from './components/question-components.ts';
import { arrowComponent, connectorComponent, diagramComponent, shapeComponent } from './components/shape-components.ts';
import { bulletListComponent, calloutComponent, paragraphComponent, tableComponent, titleComponent } from './components/text-components.ts';
import { SlideLayoutEngine } from './layout/slide-layout-engine.ts';

export * from './component-catalog.ts';
export * from './component-definition.ts';
export * from './geometry.ts';
export * from './icons.ts';
export * from './slide-types.ts';
export * from './theme-tokens.ts';
export * from './layout/slide-layout-engine.ts';

// Validation messages reach people in the editor, so Zod reports them in Spanish.
z.config(z.locales.es());

/** Full component catalog (28 components). */
export const BASE_COMPONENTS: readonly ComponentDefinition[] = [
  // Text
  titleComponent,
  paragraphComponent,
  bulletListComponent,
  calloutComponent,
  tableComponent,
  // Media
  imageComponent,
  videoComponent,
  audioComponent,
  iconComponent,
  illustrationComponent,
  // Shapes
  shapeComponent,
  arrowComponent,
  connectorComponent,
  diagramComponent,
  // Interactive
  flipCardComponent,
  buttonLinkComponent,
  hotspotComponent,
  tabsComponent,
  accordionComponent,
  galleryComponent,
  timelineComponentDef,
  timerComponent,
  // Questions
  multipleChoiceComponent,
  trueFalseComponent,
  fillBlankComponent,
  dragDropComponent,
  orderingComponent,
  matchingComponent,
];

export const componentCatalog = new ComponentCatalog(BASE_COMPONENTS);

export const slideLayoutEngine = new SlideLayoutEngine(componentCatalog);

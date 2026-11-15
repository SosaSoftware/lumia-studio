import { z } from 'zod';
import { ComponentCatalog } from './component-catalog.ts';
import type { ComponentDefinition } from './component-definition.ts';
import {
  accordionComponent,
  buttonLinkComponent,
  contentGridComponent,
  diceComponent,
  flipCardComponent,
  hotspotComponent,
  rouletteComponent,
  scratchCardComponent,
  tabsComponent,
  timelineComponentDef,
  timerComponent,
} from './components/interactive-components.ts';
import { characterGuideComponent, comicComponent, emotionAvatarComponent, sceneBackgroundComponent } from './components/character-components.ts';
import { hangmanComponent, memoryComponent, racingComponent, wordSearchComponent } from './components/game-components.ts';
import { lumiBubbleComponent, lumiOrbComponent } from './components/lumi-components.ts';
import { badgeComponent, confettiComponent, stickerComponent } from './components/decorative-components.ts';
import {
  barChartComponent,
  counterComponent,
  donutChartComponent,
  progressBarComponent,
  progressRingComponent,
  statCardComponent,
} from './components/data-components.ts';
import {
  animationComponent,
  audioComponent,
  beforeAfterComponent,
  carouselComponent,
  galleryComponent,
  iconComponent,
  illustrationComponent,
  imageComponent,
  videoComponent,
} from './components/media-components.ts';
import {
  dragDropComponent,
  fillBlankComponent,
  matchingComponent,
  multipleChoiceComponent,
  orderingComponent,
  quizTimerComponent,
  trueFalseComponent,
} from './components/question-components.ts';
import {
  arrowComponent,
  connectorComponent,
  diagramComponent,
  funnelComponent,
  mindmapComponent,
  pyramidComponent,
  shapeComponent,
  vennComponent,
} from './components/shape-components.ts';
import {
  bannerComponent,
  bulletListComponent,
  calloutComponent,
  codeSnippetComponent,
  paragraphComponent,
  paragraphHighlightComponent,
  quoteComponent,
  stepperComponent,
  tableComponent,
  titleAnimatedComponent,
  titleComponent,
  typewriterComponent,
} from './components/text-components.ts';
import { SlideLayoutEngine } from './layout/slide-layout-engine.ts';

export * from './component-catalog.ts';
export * from './component-definition.ts';
export * from './diagram-code.ts';
export * from './geometry.ts';
export * from './icons.ts';
export * from './slide-properties.ts';
export * from './theme-tokens.ts';
export * from './layout/slide-layout-engine.ts';

// Validation messages reach people in the editor, so Zod reports them in Spanish.
z.config(z.locales.es());

/** Full component catalog, in palette order inside each group. */
export const BASE_COMPONENTS: readonly ComponentDefinition[] = [
  // Text
  titleComponent,
  titleAnimatedComponent,
  paragraphComponent,
  paragraphHighlightComponent,
  bulletListComponent,
  tableComponent,
  calloutComponent,
  quoteComponent,
  bannerComponent,
  stepperComponent,
  typewriterComponent,
  codeSnippetComponent,
  // Media
  imageComponent,
  videoComponent,
  audioComponent,
  iconComponent,
  illustrationComponent,
  animationComponent,
  beforeAfterComponent,
  galleryComponent,
  carouselComponent,
  // Decorative
  stickerComponent,
  badgeComponent,
  confettiComponent,
  // Shapes
  shapeComponent,
  arrowComponent,
  connectorComponent,
  diagramComponent,
  mindmapComponent,
  pyramidComponent,
  vennComponent,
  funnelComponent,
  // Data
  barChartComponent,
  donutChartComponent,
  counterComponent,
  progressRingComponent,
  progressBarComponent,
  statCardComponent,
  // Interactive
  flipCardComponent,
  buttonLinkComponent,
  hotspotComponent,
  tabsComponent,
  accordionComponent,
  timelineComponentDef,
  timerComponent,
  contentGridComponent,
  rouletteComponent,
  diceComponent,
  scratchCardComponent,
  // Questions
  multipleChoiceComponent,
  trueFalseComponent,
  fillBlankComponent,
  dragDropComponent,
  orderingComponent,
  matchingComponent,
  quizTimerComponent,
  // Games
  memoryComponent,
  wordSearchComponent,
  hangmanComponent,
  racingComponent,
  // Characters
  characterGuideComponent,
  comicComponent,
  emotionAvatarComponent,
  sceneBackgroundComponent,
  // Lumi
  lumiOrbComponent,
  lumiBubbleComponent,
];

export const componentCatalog = new ComponentCatalog(BASE_COMPONENTS);

export const slideLayoutEngine = new SlideLayoutEngine(componentCatalog);

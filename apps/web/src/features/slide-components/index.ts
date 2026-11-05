import type { Component } from 'vue';
import AccordionBlock from './AccordionBlock.vue';
import ArrowBlock from './ArrowBlock.vue';
import AudioBlock from './AudioBlock.vue';
import BulletListBlock from './BulletListBlock.vue';
import ButtonLinkBlock from './ButtonLinkBlock.vue';
import CalloutBlock from './CalloutBlock.vue';
import ConnectorBlock from './ConnectorBlock.vue';
import DiagramBlock from './DiagramBlock.vue';
import DragDropBlock from './DragDropBlock.vue';
import FillBlankBlock from './FillBlankBlock.vue';
import FlipCardBlock from './FlipCardBlock.vue';
import GalleryBlock from './GalleryBlock.vue';
import HotspotBlock from './HotspotBlock.vue';
import IconBlock from './IconBlock.vue';
import IllustrationBlock from './IllustrationBlock.vue';
import ImageBlock from './ImageBlock.vue';
import MatchingBlock from './MatchingBlock.vue';
import MultipleChoiceBlock from './MultipleChoiceBlock.vue';
import OrderingBlock from './OrderingBlock.vue';
import ParagraphBlock from './ParagraphBlock.vue';
import ShapeBlock from './ShapeBlock.vue';
import TableBlock from './TableBlock.vue';
import TabsBlock from './TabsBlock.vue';
import TimelineBlock from './TimelineBlock.vue';
import TimerBlock from './TimerBlock.vue';
import TitleBlock from './TitleBlock.vue';
import TrueFalseBlock from './TrueFalseBlock.vue';
import VideoBlock from './VideoBlock.vue';

/** One Vue component per key of the base catalog; the canvas, the thumbnails and the preview share them. */
export const CATALOG_COMPONENTS: Readonly<Record<string, Component>> = {
  title: TitleBlock,
  paragraph: ParagraphBlock,
  bullet_list: BulletListBlock,
  callout: CalloutBlock,
  table: TableBlock,
  image: ImageBlock,
  video: VideoBlock,
  audio: AudioBlock,
  icon: IconBlock,
  illustration: IllustrationBlock,
  shape: ShapeBlock,
  arrow: ArrowBlock,
  connector: ConnectorBlock,
  diagram: DiagramBlock,
  flip_card: FlipCardBlock,
  button_link: ButtonLinkBlock,
  hotspot: HotspotBlock,
  tabs: TabsBlock,
  accordion: AccordionBlock,
  gallery: GalleryBlock,
  timeline_component: TimelineBlock,
  timer: TimerBlock,
  multiple_choice: MultipleChoiceBlock,
  true_false: TrueFalseBlock,
  fill_blank: FillBlankBlock,
  drag_drop: DragDropBlock,
  ordering: OrderingBlock,
  matching: MatchingBlock,
};

export function componentFor(key: string): Component | undefined {
  return CATALOG_COMPONENTS[key];
}

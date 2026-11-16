import type { Component } from 'vue';
import AccordionBlock from './AccordionBlock.vue';
import AnimationBlock from './AnimationBlock.vue';
import ArrowBlock from './ArrowBlock.vue';
import AudioBlock from './AudioBlock.vue';
import BadgeBlock from './BadgeBlock.vue';
import BannerBlock from './BannerBlock.vue';
import BarChartBlock from './BarChartBlock.vue';
import BeforeAfterBlock from './BeforeAfterBlock.vue';
import BulletListBlock from './BulletListBlock.vue';
import ButtonLinkBlock from './ButtonLinkBlock.vue';
import CalloutBlock from './CalloutBlock.vue';
import CarouselBlock from './CarouselBlock.vue';
import CharacterGuideBlock from './CharacterGuideBlock.vue';
import CodeSnippetBlock from './CodeSnippetBlock.vue';
import ComicBlock from './ComicBlock.vue';
import ConfettiBlock from './ConfettiBlock.vue';
import ConnectorBlock from './ConnectorBlock.vue';
import ContentGridBlock from './ContentGridBlock.vue';
import CounterBlock from './CounterBlock.vue';
import DiagramBlock from './DiagramBlock.vue';
import DiceBlock from './DiceBlock.vue';
import DonutChartBlock from './DonutChartBlock.vue';
import DragDropBlock from './DragDropBlock.vue';
import EmotionAvatarBlock from './EmotionAvatarBlock.vue';
import FillBlankBlock from './FillBlankBlock.vue';
import FlipCardBlock from './FlipCardBlock.vue';
import FunnelBlock from './FunnelBlock.vue';
import GalleryBlock from './GalleryBlock.vue';
import HangmanBlock from './HangmanBlock.vue';
import HotspotBlock from './HotspotBlock.vue';
import IconBlock from './IconBlock.vue';
import IllustrationBlock from './IllustrationBlock.vue';
import ImageBlock from './ImageBlock.vue';
import LumiBubbleBlock from './LumiBubbleBlock.vue';
import LumiOrbBlock from './LumiOrbBlock.vue';
import MatchingBlock from './MatchingBlock.vue';
import MemoryBlock from './MemoryBlock.vue';
import MindmapBlock from './MindmapBlock.vue';
import MultipleChoiceBlock from './MultipleChoiceBlock.vue';
import OrderingBlock from './OrderingBlock.vue';
import ParagraphBlock from './ParagraphBlock.vue';
import ParagraphHighlightBlock from './ParagraphHighlightBlock.vue';
import ProgressBarBlock from './ProgressBarBlock.vue';
import ProgressRingBlock from './ProgressRingBlock.vue';
import PyramidBlock from './PyramidBlock.vue';
import QuizTimerBlock from './QuizTimerBlock.vue';
import QuoteBlock from './QuoteBlock.vue';
import RacingBlock from './RacingBlock.vue';
import RouletteBlock from './RouletteBlock.vue';
import SceneBackgroundBlock from './SceneBackgroundBlock.vue';
import ScratchCardBlock from './ScratchCardBlock.vue';
import ShapeBlock from './ShapeBlock.vue';
import StatCardBlock from './StatCardBlock.vue';
import StepperBlock from './StepperBlock.vue';
import StickerBlock from './StickerBlock.vue';
import TableBlock from './TableBlock.vue';
import TabsBlock from './TabsBlock.vue';
import TimelineBlock from './TimelineBlock.vue';
import TimerBlock from './TimerBlock.vue';
import TitleAnimatedBlock from './TitleAnimatedBlock.vue';
import TitleBlock from './TitleBlock.vue';
import TrueFalseBlock from './TrueFalseBlock.vue';
import TypewriterBlock from './TypewriterBlock.vue';
import VennBlock from './VennBlock.vue';
import VideoBlock from './VideoBlock.vue';
import WordSearchBlock from './WordSearchBlock.vue';

/** One Vue component per key of the base catalog; the canvas, the thumbnails and the preview share them. */
export const CATALOG_COMPONENTS: Readonly<Record<string, Component>> = {
  title: TitleBlock,
  title_animated: TitleAnimatedBlock,
  paragraph: ParagraphBlock,
  paragraph_highlight: ParagraphHighlightBlock,
  bullet_list: BulletListBlock,
  table: TableBlock,
  callout: CalloutBlock,
  quote: QuoteBlock,
  banner: BannerBlock,
  stepper: StepperBlock,
  typewriter: TypewriterBlock,
  code_snippet: CodeSnippetBlock,
  image: ImageBlock,
  video: VideoBlock,
  audio: AudioBlock,
  icon: IconBlock,
  illustration: IllustrationBlock,
  animation: AnimationBlock,
  before_after: BeforeAfterBlock,
  gallery: GalleryBlock,
  carousel: CarouselBlock,
  sticker: StickerBlock,
  badge: BadgeBlock,
  confetti: ConfettiBlock,
  shape: ShapeBlock,
  arrow: ArrowBlock,
  connector: ConnectorBlock,
  diagram: DiagramBlock,
  mindmap: MindmapBlock,
  pyramid: PyramidBlock,
  venn: VennBlock,
  funnel: FunnelBlock,
  bar_chart: BarChartBlock,
  donut_chart: DonutChartBlock,
  counter: CounterBlock,
  progress_ring: ProgressRingBlock,
  progress_bar: ProgressBarBlock,
  stat_card: StatCardBlock,
  flip_card: FlipCardBlock,
  button_link: ButtonLinkBlock,
  hotspot: HotspotBlock,
  tabs: TabsBlock,
  accordion: AccordionBlock,
  timeline_component: TimelineBlock,
  timer: TimerBlock,
  content_grid: ContentGridBlock,
  roulette: RouletteBlock,
  dice: DiceBlock,
  scratch_card: ScratchCardBlock,
  multiple_choice: MultipleChoiceBlock,
  true_false: TrueFalseBlock,
  fill_blank: FillBlankBlock,
  drag_drop: DragDropBlock,
  ordering: OrderingBlock,
  matching: MatchingBlock,
  quiz_timer: QuizTimerBlock,
  memory: MemoryBlock,
  word_search: WordSearchBlock,
  hangman: HangmanBlock,
  racing: RacingBlock,
  character_guide: CharacterGuideBlock,
  comic: ComicBlock,
  emotion_avatar: EmotionAvatarBlock,
  scene_background: SceneBackgroundBlock,
  lumi_orb: LumiOrbBlock,
  lumi_bubble: LumiBubbleBlock,
};

export function componentFor(key: string): Component | undefined {
  return CATALOG_COMPONENTS[key];
}

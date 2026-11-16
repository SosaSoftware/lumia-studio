<script setup lang="ts">
import { computed } from 'vue';
import { ADVANCING_BUTTON_ACTIONS, BUTTON_COMPONENT, SLIDE_TITLE_MAX_LENGTH, START_BUTTON_ACTION } from '@lumia/packages/catalog';
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { NEXT_UNLOCKS, START_MODES, TRANSITIONS } from '../../api/types.ts';
import type { NextUnlock, Slide, SlidePatch, StartMode, Transition } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { lang, t } from '../../i18n/index.ts';
import { componentName } from '../editor/catalog-labels.ts';
import { unlockLabel, startModeLabel, audioKindLabel, autoTimerEnd, formatTime, narrationDuration, slideDuration, transitionLabel } from '../timeline/timeline-model.ts';
import { groupColor, tagGroup } from '../palette/palette.ts';
import ChipGroup from './ChipGroup.vue';
import ColorSwatches from './ColorSwatches.vue';
import { inputValue } from './controls.ts';
import NumberField from './NumberField.vue';
import { activeStartButton } from '../slides/slide-buttons.ts';
import { PropertyPanelLayout } from './property-layout.ts';
import type { SlideField } from './property-layout.ts';
import PropertySectionGroup from './PropertySectionGroup.vue';

const props = defineProps<{ slide: Slide }>();

const workspace = useWorkspace();
const session = workspace.session;
const canEdit = computed(() => canChange(ACTIONS.edit));
const transitions = computed(() => TRANSITIONS.map((value) => ({ value, label: transitionLabel(value) })));
/** Whether the slide has a question or a game, the condition of "Al completar actividades". */
const hasActivities = computed(() => props.slide.elements.some((element) => workspace.catalog.component(element.component)?.isQuestion === true));

/** Buttons of the slide whose action is one of `actions`, as options of a select. */
function buttonsWith(actions: readonly string[]): { value: string; label: string }[] {
  return props.slide.elements
    .filter((element) => element.component === BUTTON_COMPONENT && typeof element.props.action === 'string' && actions.includes(element.props.action))
    .map((element) => ({ value: element.id, label: element.name }));
}

/** Buttons that can start the slide, and buttons that can replace the lateral Next. */
const startButtons = computed(() => buttonsWith([START_BUTTON_ACTION]));
const advancingButtons = computed(() => buttonsWith(ADVANCING_BUTTON_ACTIONS));

const unlocks = computed(() =>
  NEXT_UNLOCKS.map((value) => {
    if (value === props.slide.unlock) return { value, label: unlockLabel(value) };
    if (value === 'after_activities' && !hasActivities.value) return { value, label: unlockLabel(value), disabled: true, hint: t('properties.slide.unlockNeedsActivity') };
    if (value === 'custom_button' && advancingButtons.value.length === 0) return { value, label: unlockLabel(value), disabled: true, hint: t('properties.slide.unlockNeedsButton') };
    return { value, label: unlockLabel(value) };
  }),
);
const unlockHint = computed(() =>
  props.slide.unlock === 'after_activities' && !hasActivities.value ? t('properties.slide.noActivities') : t(`properties.slide.unlockHints.${props.slide.unlock}`),
);
const startModes = computed(() => START_MODES.map((value) => ({ value, label: startModeLabel(value) })));

/** The duration and the way the slide starts only apply when the Next button waits for the time. */
const waitsForTime = computed(() => props.slide.unlock === 'after_time');
const startsWithButton = computed(() => waitsForTime.value && props.slide.startMode === 'button');
const startButtonMissing = computed(() => startsWithButton.value && !startButtons.value.some((button) => button.value === props.slide.startElementId));
const customButtonMissing = computed(() => props.slide.unlock === 'custom_button' && !advancingButtons.value.some((button) => button.value === props.slide.unlockElementId));
const effective = computed(() => slideDuration(props.slide));

const slideLabels = computed<Record<SlideField, string>>(() => ({
  title: t('properties.slide.title'),
  unlock: t('properties.slide.unlock'),
  unlockElementId: t('properties.slide.customButton'),
  durationS: t('common.duration'),
  startMode: t('properties.slide.startMode'),
  startElementId: t('properties.slide.startButton'),
  background: t('properties.slide.background'),
  transition: t('properties.slide.entryTransition'),
}));
const sections = computed(() => new PropertyPanelLayout(workspace.catalog.info.value, lang.value).buildSlide(slideLabels.value));

/** Narration, audio and pauses in the order they start. */
const audioItems = computed(() =>
  [
    ...props.slide.narrationClips.map((clip, index) => ({ at: clip.startsAtS, text: t('properties.slide.narrationItem', { script: clip.script.trim() === '' ? t('properties.slide.noScript') : clip.script }), color: 'var(--tl-narr)', select: (): void => {
      session.selectClip({ kind: 'narration', id: clip.id });
    }, key: `n${String(index)}` })),
    ...props.slide.audioClips.map((clip, index) => ({ at: clip.startsAtS, text: `${audioKindLabel(clip.kind)} · ${clip.name}`, color: 'var(--tl-audio)', select: (): void => {
      session.selectClip({ kind: 'audio', id: clip.id });
    }, key: `a${String(index)}` })),
    ...props.slide.pauses.map((pause, index) => ({ at: pause.startsAtS, text: t('properties.slide.pauseItem', { seconds: pause.durationS, message: pause.message }), color: 'var(--tl-pause)', select: (): void => {
      session.selectClip({ kind: 'pause', id: pause.id });
    }, key: `p${String(index)}` })),
  ].sort((a, b) => a.at - b.at),
);

/** Components in the order they appear, as the timeline shows them. */
const order = computed(() =>
  [...props.slide.elements]
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.appearsAtS - b.element.appearsAtS || a.index - b.index)
    .map(({ element }) => {
      const info = workspace.catalog.component(element.component);
      return { element, name: info === undefined ? element.component : componentName(info), color: groupColor(info?.group ?? ''), group: tagGroup(info?.group ?? '') };
    }),
);

const narrationEnd = computed(() => props.slide.narrationClips.reduce((end, clip) => Math.max(end, clip.startsAtS + narrationDuration(clip)), 0));
const timerEnd = computed(() => props.slide.elements.reduce((end, element) => Math.max(end, autoTimerEnd(element) ?? 0), 0));
/** Why the slide lasts longer than its duration: its narration or a timer that starts by itself. */
const extension = computed(() =>
  timerEnd.value > narrationEnd.value
    ? t('properties.slide.timerEnds', { time: formatTime(timerEnd.value) })
    : t('properties.slide.narrationEnds', { time: formatTime(narrationEnd.value) }),
);

function setTitle(event: Event): void {
  session.updateSlide(props.slide.id, { title: inputValue(event) });
}

function setBackground(value: ThemeColorKey): void {
  session.updateSlide(props.slide.id, { background: value });
}

function setDuration(value: number): void {
  session.updateSlide(props.slide.id, { durationS: Math.max(1, Math.round(value)) });
}

function setTransition(value: Transition): void {
  session.updateSlide(props.slide.id, { transition: value });
}

/** The only candidate button is chosen at once, so the rule works without another step. */
function onlyButton(buttons: readonly { value: string }[], current: string | null): string | null {
  if (buttons.some((button) => button.value === current)) return current;
  const [only] = buttons;
  return buttons.length === 1 && only !== undefined ? only.value : current;
}

/** Saves the slide; a button that becomes its start button moves to second 0, because the slide starts with it. */
function saveSlide(patch: SlidePatch): void {
  session.updateSlide(props.slide.id, patch);
  const button = activeStartButton({ ...props.slide, ...patch });
  if (button !== null && button.appearsAtS !== 0) session.updateElement(button.id, { appearsAtS: 0 });
}

function setUnlock(value: NextUnlock): void {
  const patch: SlidePatch = { unlock: value };
  if (value === 'custom_button') patch.unlockElementId = onlyButton(advancingButtons.value, props.slide.unlockElementId);
  saveSlide(patch);
}

function setStartMode(value: StartMode): void {
  const patch: SlidePatch = { startMode: value };
  if (value === 'button') patch.startElementId = onlyButton(startButtons.value, props.slide.startElementId);
  saveSlide(patch);
}

function setButton(field: 'startElementId' | 'unlockElementId', event: Event): void {
  const value = inputValue(event);
  saveSlide({ [field]: value === '' ? null : value });
}
</script>

<template>
  <div class="prop-body">
    <PropertySectionGroup v-for="section in sections" :key="section.key" :section="section">
      <template #default="{ blocks }">
        <template v-for="block in blocks" :key="block.kind === 'props' ? 'props' : block.field">
          <div v-if="block.kind === 'slide' && block.field === 'title'" class="prop-field">
            <label class="prop-label" for="prop-slide-title">{{ block.label }}</label>
            <input id="prop-slide-title" class="pv prop-control" type="text" :maxlength="SLIDE_TITLE_MAX_LENGTH" :value="slide.title" :disabled="!canEdit" data-testid="prop-slide-title" @input="setTitle" />
          </div>

          <div v-else-if="block.kind === 'slide' && block.field === 'unlock'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <ChipGroup :options="unlocks" :model-value="slide.unlock" :label="block.label" :disabled="!canEdit" testid="prop-slide-unlock" @update:model-value="setUnlock" />
            <span class="prop-hint" data-testid="prop-slide-unlock-hint">{{ unlockHint }} {{ t('properties.slide.neverAutomatic') }}</span>
          </div>

          <div v-else-if="block.kind === 'slide' && block.field === 'unlockElementId' && slide.unlock === 'custom_button'" class="prop-field">
            <label class="prop-label" for="prop-slide-custom-button">{{ block.label }}</label>
            <select id="prop-slide-custom-button" class="pv prop-control" :value="slide.unlockElementId ?? ''" :disabled="!canEdit" data-testid="prop-slide-custom-button" @change="setButton('unlockElementId', $event)">
              <option value="">{{ t('properties.slide.chooseButton') }}</option>
              <option v-for="button in advancingButtons" :key="button.value" :value="button.value">{{ button.label }}</option>
            </select>
            <span v-if="customButtonMissing" class="prop-warning" role="status" data-testid="prop-slide-custom-missing">{{ t('properties.slide.missingCustomButton') }}</span>
          </div>

          <div v-else-if="block.kind === 'slide' && block.field === 'durationS'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <NumberField
              :model-value="slide.durationS"
              :label="t('common.durationSeconds')"
              unit="s"
              :min="1"
              :max="3600"
              :disabled="!canEdit || !waitsForTime"
              :title="waitsForTime ? undefined : t('properties.slide.durationOnlyTime')"
              testid="prop-slide-duration"
              @update:model-value="setDuration"
            />
            <span v-if="!waitsForTime" class="prop-hint" data-testid="prop-slide-duration-off">{{ t('properties.slide.durationOnlyTime') }}</span>
            <span v-else-if="effective > slide.durationS" class="prop-warning" data-testid="prop-slide-extension">{{ t('properties.slide.endsAfterTime', { reason: extension }) }}</span>
          </div>

          <div v-else-if="block.kind === 'slide' && block.field === 'startMode' && waitsForTime" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <ChipGroup :options="startModes" :model-value="slide.startMode" :label="block.label" :disabled="!canEdit" testid="prop-slide-start-mode" @update:model-value="setStartMode" />
            <span class="prop-hint" data-testid="prop-slide-start-mode-hint">{{ t(`properties.slide.startModeHints.${slide.startMode}`) }}</span>
          </div>

          <div v-else-if="block.kind === 'slide' && block.field === 'startElementId' && startsWithButton" class="prop-field">
            <label class="prop-label" for="prop-slide-start-button">{{ block.label }}</label>
            <select v-if="startButtons.length > 0" id="prop-slide-start-button" class="pv prop-control" :value="slide.startElementId ?? ''" :disabled="!canEdit" data-testid="prop-slide-start-button" @change="setButton('startElementId', $event)">
              <option value="">{{ t('properties.slide.chooseButton') }}</option>
              <option v-for="button in startButtons" :key="button.value" :value="button.value">{{ button.label }}</option>
            </select>
            <span v-if="startButtons.length === 0" class="prop-hint" data-testid="prop-slide-no-start-buttons">{{ t('properties.slide.noStartButtons') }}</span>
            <span v-else-if="startButtonMissing" class="prop-warning" role="status" data-testid="prop-slide-start-missing">{{ t('properties.slide.missingStartButton') }}</span>
          </div>

          <div v-else-if="block.kind === 'slide' && block.field === 'background'" class="prop-field">
            <span class="prop-label">{{ block.label }}</span>
            <ColorSwatches :model-value="slide.background" :label="block.label" :disabled="!canEdit" testid="prop-slide-background" @update:model-value="setBackground" />
          </div>

          <template v-else-if="block.kind === 'slide' && block.field === 'transition'">
            <div class="prop-field">
              <span class="prop-label">{{ block.label }}</span>
              <ChipGroup :options="transitions" :model-value="slide.transition" :label="block.label" :disabled="!canEdit" testid="prop-slide-transition" @update:model-value="setTransition" />
            </div>
            <div class="prop-field">
              <span class="prop-label">{{ t('common.duration') }}</span>
              <div class="pv prop-readonly" aria-readonly="true">0.5 s</div>
            </div>
          </template>
        </template>
      </template>
    </PropertySectionGroup>
    <span v-if="session.state.slideErrors[slide.id]" class="prop-error" role="alert" data-testid="field-error-slide">{{ session.state.slideErrors[slide.id] }}</span>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.slide.audioNarration') }}</h3>
      <div v-if="audioItems.length > 0" class="prop-list">
        <button v-for="item in audioItems" :key="item.key" type="button" class="mi" @click="item.select()">
          <span class="prop-list-dot" :style="{ background: item.color }"></span>
          <span class="prop-list-text">{{ item.text }}</span>
          <span class="prop-list-time">{{ formatTime(item.at) }}</span>
        </button>
      </div>
      <div v-else class="pv prop-readonly">{{ t('properties.slide.noAudio') }}</div>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.slide.appearanceOrder') }}</h3>
      <div v-if="order.length > 0" class="prop-list">
        <button v-for="item in order" :key="item.element.id" type="button" class="mi" :data-testid="`prop-order-${item.element.id}`" @click="session.selectElement(item.element.id)">
          <span class="prop-list-dot" :style="{ background: item.color }"></span>
          <span class="prop-list-text">{{ item.name }} · {{ item.element.name }}</span>
          <span class="prop-list-time">{{ formatTime(item.element.appearsAtS) }}</span>
        </button>
      </div>
      <div v-else class="pv prop-readonly">{{ t('properties.slide.noComponents') }}</div>
    </section>
  </div>
</template>

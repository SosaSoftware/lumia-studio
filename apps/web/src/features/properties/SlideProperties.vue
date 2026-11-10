<script setup lang="ts">
import { computed } from 'vue';
import { SLIDE_TITLE_MAX_LENGTH } from '@lumia/packages/catalog';
import type { ThemeColorKey } from '@lumia/packages/catalog';
import { ADVANCE_MODES, TRANSITIONS } from '../../api/types.ts';
import type { AdvanceMode, Slide, Transition } from '../../api/types.ts';
import { ACTIONS } from '../../composables/app-context.ts';
import { canChange } from '../../composables/edit-lock.ts';
import { useWorkspace } from '../../composables/workspace.ts';
import { t } from '../../i18n/index.ts';
import { componentName } from '../editor/catalog-labels.ts';
import { advanceLabel, audioKindLabel, autoTimerEnd, formatTime, narrationDuration, slideDuration, transitionLabel } from '../timeline/timeline-model.ts';
import { groupColor, tagGroup } from '../palette/palette.ts';
import ChipGroup from './ChipGroup.vue';
import ColorSwatches from './ColorSwatches.vue';
import { inputValue } from './controls.ts';
import NumberField from './NumberField.vue';

const props = defineProps<{ slide: Slide }>();

const workspace = useWorkspace();
const session = workspace.session;
const canEdit = computed(() => canChange(ACTIONS.edit));
const transitions = computed(() => TRANSITIONS.map((value) => ({ value, label: transitionLabel(value) })));
/** Whether the slide has a question component, the condition of "Al completar". */
const hasQuestions = computed(() => props.slide.elements.some((element) => workspace.catalog.component(element.component)?.isQuestion === true));
const advances = computed(() =>
  ADVANCE_MODES.map((value) =>
    value === 'on_complete' && !hasQuestions.value
      ? { value, label: advanceLabel(value), disabled: true, hint: t('properties.slide.advanceNeedsQuestion') }
      : { value, label: advanceLabel(value) },
  ),
);
const advanceHint = computed(() =>
  props.slide.advance === 'on_complete' && !hasQuestions.value ? t('properties.slide.noQuestions') : t(`properties.slide.advanceHints.${props.slide.advance}`),
);
const effective = computed(() => slideDuration(props.slide));

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

function setAdvance(value: AdvanceMode): void {
  session.updateSlide(props.slide.id, { advance: value });
}
</script>

<template>
  <div class="prop-body">
    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.slide.section') }}</h3>
      <div class="prop-field">
        <label class="prop-label" for="prop-slide-title">{{ t('properties.slide.title') }}</label>
        <input id="prop-slide-title" class="pv prop-control" type="text" :maxlength="SLIDE_TITLE_MAX_LENGTH" :value="slide.title" :disabled="!canEdit" data-testid="prop-slide-title" @input="setTitle" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.slide.background') }}</span>
        <ColorSwatches :model-value="slide.background" :label="t('properties.slide.background')" :disabled="!canEdit" testid="prop-slide-background" @update:model-value="setBackground" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.duration') }}</span>
        <NumberField :model-value="slide.durationS" :label="t('common.durationSeconds')" unit="s" :min="1" :max="3600" :disabled="!canEdit" testid="prop-slide-duration" @update:model-value="setDuration" />
        <span v-if="effective > slide.durationS" class="prop-hint" data-testid="prop-slide-extension">{{ t('properties.slide.extension', { reason: extension, time: formatTime(effective) }) }}</span>
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('properties.slide.advance') }}</span>
        <ChipGroup :options="advances" :model-value="slide.advance" :label="t('properties.slide.advance')" :disabled="!canEdit" testid="prop-slide-advance" @update:model-value="setAdvance" />
        <span class="prop-hint" data-testid="prop-slide-advance-hint">{{ advanceHint }}</span>
      </div>
      <span v-if="session.state.slideErrors[slide.id]" class="prop-error" role="alert" data-testid="field-error-slide">{{ session.state.slideErrors[slide.id] }}</span>
    </section>

    <section class="prop-sec">
      <h3 class="lbl">{{ t('properties.slide.entryTransition') }}</h3>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.effect') }}</span>
        <ChipGroup :options="transitions" :model-value="slide.transition" :label="t('properties.slide.entryTransition')" :disabled="!canEdit" testid="prop-slide-transition" @update:model-value="setTransition" />
      </div>
      <div class="prop-field">
        <span class="prop-label">{{ t('common.duration') }}</span>
        <div class="pv prop-readonly" aria-readonly="true">0.5 s</div>
      </div>
    </section>

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

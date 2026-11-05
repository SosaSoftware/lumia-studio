<script setup lang="ts">
import { computed } from 'vue';
import { parseBlocks } from './rich-text.ts';

const props = defineProps<{ text: string }>();
const blocks = computed(() => parseBlocks(props.text));
</script>

<template>
  <div class="rich">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.kind === 'p'"><template v-for="(part, partIndex) in block.inlines" :key="partIndex"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p>
      <component :is="block.kind" v-else>
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><template v-for="(part, partIndex) in item" :key="partIndex"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></li>
      </component>
    </template>
  </div>
</template>

<style scoped>
.rich { display: flex; flex-direction: column; gap: 6px; line-height: 1.55; overflow-wrap: anywhere; }
.rich p { margin: 0; white-space: pre-wrap; }
.rich ul, .rich ol { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.rich strong { font-weight: 600; }
</style>

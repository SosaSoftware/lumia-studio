<script setup lang="ts">
import { computed } from 'vue';
import { str } from '../../api/decode.ts';
import { CodeHighlighter } from './code-highlighter.ts';
import type { CatalogComponentProps } from './element-mode.ts';
import { parseLineSpec } from './render-helpers.ts';

const props = defineProps<CatalogComponentProps>();
const language = computed(() => str(props.data.language, 'text'));
const lines = computed(() => new CodeHighlighter(language.value).highlight(str(props.data.code)));
const marked = computed(() => parseLineSpec(str(props.data.highlightLines)));
const title = computed(() => str(props.data.title).trim());

const LANGUAGES: Readonly<Record<string, string>> = { text: 'Texto', javascript: 'JavaScript', python: 'Python', html: 'HTML', css: 'CSS', json: 'JSON', sql: 'SQL' };
</script>

<template>
  <figure class="el-code" :data-theme="str(data.theme, 'dark')" :data-size="str(data.size, 'md')" data-testid="code-snippet">
    <figcaption class="bar">
      <span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="title">{{ title }}</span>
      <span class="language">{{ LANGUAGES[language] ?? language }}</span>
    </figcaption>
    <pre class="body" :aria-label="`Código ${LANGUAGES[language] ?? language}`"><code><span v-for="(line, index) in lines" :key="index" class="line" :data-marked="marked.has(index + 1)"><span v-if="data.showLineNumbers !== false" class="number" aria-hidden="true">{{ index + 1 }}</span><span class="content"><span v-for="(token, position) in line" :key="position" :data-kind="token.kind">{{ token.text }}</span></span>
</span></code></pre>
  </figure>
</template>

<style scoped>
.el-code { --bg: #161B26; --bar: #1F2635; --fg: #E6EAF2; --dim: #6B7689; --kw: #C792EA; --st: #C3E88D; --nu: #F78C6C; --fn: #82AAFF; --tag: #F07178; --mark: rgba(130, 170, 255, 0.16); margin: 0; overflow: hidden; border-radius: 1.4cqw; background: var(--bg); color: var(--fg); box-shadow: var(--sl-elev-2); font-size: 1.5cqw; }
.el-code[data-theme='light'] { --bg: #FFFFFF; --bar: #F1F0EC; --fg: #1F2430; --dim: #8F8D88; --kw: #7C4DFF; --st: #0B7A5A; --nu: #B4530F; --fn: #1F4FD6; --tag: #C92A2A; --mark: rgba(47, 107, 255, 0.1); border: 0.12cqw solid var(--sl-line); }
.el-code[data-size='sm'] { font-size: 1.2cqw; }
.el-code[data-size='lg'] { font-size: 1.85cqw; }
.bar { display: flex; align-items: center; gap: 1.2cqw; padding: 0.9cqw 1.4cqw; background: var(--bar); font-size: 1.15cqw; color: var(--dim); }
.lights { display: flex; gap: 0.5cqw; }
.lights i { width: 1cqw; height: 1cqw; border-radius: 50%; background: #FF5F57; }
.lights i:nth-child(2) { background: #FEBC2E; }
.lights i:nth-child(3) { background: #28C840; }
.title { flex: 1; min-width: 0; font-family: var(--sl-font-mono); color: var(--fg); opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.language { flex: none; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.body { margin: 0; padding: 1.2cqw 0; font-family: var(--sl-font-mono); font-size: inherit; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; }
.line { display: flex; padding: 0 1.6cqw 0 0; border-left: 0.35cqw solid transparent; }
.line[data-marked='true'] { background: var(--mark); border-left-color: var(--fn); }
.number { width: 3.4em; flex: none; padding-right: 1.1em; box-sizing: border-box; text-align: right; color: var(--dim); user-select: none; }
.content { flex: 1; min-width: 0; padding-left: 0.2em; }
.line:not(:has(.number)) .content { padding-left: 1.4cqw; }
[data-kind='keyword'] { color: var(--kw); }
[data-kind='string'] { color: var(--st); }
[data-kind='number'] { color: var(--nu); }
[data-kind='function'] { color: var(--fn); }
[data-kind='tag'] { color: var(--tag); }
[data-kind='comment'] { color: var(--dim); font-style: italic; }
[data-kind='punctuation'] { opacity: 0.8; }
</style>

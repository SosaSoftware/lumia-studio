/**
 * Bundles the AgentCore entry point of Lumi into `dist/remote.mjs` and its chunks: ES modules with every dependency,
 * so the container image needs no `node_modules`. The image adds the files that define Lumi next to them, in the
 * same layout as the package: `src/prompts`, `skills` and `policies`.
 *
 * Run with `npm run build -w @lumia/agent`.
 */
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Optional peer dependencies of the Strands SDK that Lumi does not install: other model providers, S3 Vectors search
 * and Cedar schema generation. The harness reaches them only through dynamic `import()`, so with code splitting they
 * load only if those paths run, exactly as an absent optional peer behaves in `node_modules`. Lumi never runs them.
 */
const ABSENT_OPTIONAL_PEERS = ['@anthropic-ai/sdk', '@google/genai', 'openai', '@aws-sdk/client-s3vectors', '@cedar-policy/mcp-schema-generator-wasm'];

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: { remote: 'src/entrypoints/remote.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  // Each module loaded with `import()` gets its own chunk, so its imports run only when it is loaded.
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ABSENT_OPTIONAL_PEERS,
  // CommonJS dependencies (Express, the AWS SDK) call `require`, which an ES module does not define.
  banner: { js: "import { createRequire as __lumiCreateRequire } from 'node:module'; const require = __lumiCreateRequire(import.meta.url);" },
  // Class names stay as written, for logs and for libraries that read `constructor.name`.
  keepNames: true,
  // Stack traces map to the TypeScript sources with `node --enable-source-maps`; the maps do not embed them.
  sourcemap: 'linked',
  sourcesContent: false,
  metafile: true,
  logLevel: 'warning',
});

const outputs = Object.entries(result.metafile.outputs).filter(([file]) => file.endsWith('.mjs'));
const bytes = outputs.reduce((total, [, output]) => total + output.bytes, 0);
process.stdout.write(`Built dist/remote.mjs and ${String(outputs.length - 1)} chunks (${(bytes / 1024 / 1024).toFixed(1)} MiB).\n`);

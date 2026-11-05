import { defineConfig } from 'vitest/config';

// Integration tests run Lumi against a local Studio (the sandbox API and the gateway emulator, in-process) on the
// sandbox Postgres (`npm run sandbox:init`). They use a scripted model and never call Bedrock.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.integration.test.ts'],
    setupFiles: ['./test/load-env.ts'],
    fileParallelism: false,
  },
});

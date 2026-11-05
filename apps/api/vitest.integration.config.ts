import { defineConfig } from 'vitest/config';

// Integration tests run against the sandbox Postgres (`npm run sandbox:init`), one file at a time.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.integration.test.ts'],
    setupFiles: ['./test/support/load-env.ts'],
    fileParallelism: false,
  },
});

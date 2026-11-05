import { defineConfig } from 'vitest/config';

// Functional tests run Lumi with its real model on Amazon Bedrock against the sandbox services. They cost model
// tokens, so they are outside `npm run verify`: run them with `npm run test:functional -w @lumia/agent`.
export default defineConfig({
  test: {
    include: ['test/functional/**/*.functional.test.ts'],
    setupFiles: ['./test/load-env.ts'],
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 60_000,
  },
});

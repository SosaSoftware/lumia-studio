import { defineConfig } from 'vitest/config';

// Hermetic tests: no network, no AWS and no sandbox services. They run in `npm run verify`.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});

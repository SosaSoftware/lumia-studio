import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Integration and functional tests read the sandbox settings from the repository `.env`; variables already set win.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

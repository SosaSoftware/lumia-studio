import { loadEnvFileIfPresent } from '../../src/shared/config/index.ts';

// Integration tests read the sandbox settings from the repository `.env`.
loadEnvFileIfPresent(new URL('../../../../.env', import.meta.url));

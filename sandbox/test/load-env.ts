import { loadEnvFileIfPresent } from '@lumia/api/config';

// Integration tests read the sandbox settings from the repository `.env`.
loadEnvFileIfPresent(new URL('../../.env', import.meta.url));

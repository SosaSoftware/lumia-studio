import { rec, str } from '../../api/decode.ts';
import { t } from '../../i18n/index.ts';

/** Written by the CDK next to config.json: `{ "file": "/demo-content/demo.lumia" }`. */
export const DEMO_SETTINGS_URL = '/demo.json';

/** There is no demo to show yet (no settings, or the file is not in the demo bucket). */
export class DemoUnavailableError extends Error {
  public constructor() {
    super(t('demo.unavailable'));
    this.name = 'DemoUnavailableError';
  }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Path of the .lumia of the demo; only paths of this site are accepted. */
export async function demoFileUrl(fetcher: Fetcher = fetch): Promise<string> {
  const response = await fetcher(DEMO_SETTINGS_URL, { cache: 'no-store' });
  if (!response.ok) throw new DemoUnavailableError();
  const file = str(rec(await response.json().catch(() => null)).file);
  if (!file.startsWith('/') || file.startsWith('//')) throw new DemoUnavailableError();
  return file;
}

/** Downloads the file and reports the fraction received when the size is known. */
export async function download(url: string, onProgress: (fraction: number) => void, fetcher: Fetcher = fetch): Promise<Uint8Array> {
  const response = await fetcher(url);
  // The bucket answers 403 (not 404) for a file that is not there yet.
  if (response.status === 403 || response.status === 404) throw new DemoUnavailableError();
  if (!response.ok || response.body === null) throw new Error(t('errors.demoDownload', { status: response.status }));
  const total = Number(response.headers.get('content-length') ?? '0');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) onProgress(Math.min(1, received / total));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(1);
  return bytes;
}

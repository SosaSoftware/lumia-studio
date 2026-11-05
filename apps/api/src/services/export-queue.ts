import { InvokeCommand } from '@aws-sdk/client-lambda';
import type { LambdaClient } from '@aws-sdk/client-lambda';

/** Starts the export of a published version. Publishing does not wait for it: a class with videos can take a while. */
export interface ExportQueue {
  /** False where published classes are not exported (the sandbox). */
  readonly enabled: boolean;
  request(versionId: string): Promise<void>;
}

/** The sandbox only previews classes; it does not export them. */
export const NO_EXPORTS: ExportQueue = {
  enabled: false,
  request: () => Promise.resolve(),
};

/** Invokes the export Lambda asynchronously; Lambda retries a failed export twice. */
export class LambdaExportQueue implements ExportQueue {
  public readonly enabled = true;

  public constructor(
    private readonly client: LambdaClient,
    private readonly functionName: string,
  ) {}

  public async request(versionId: string): Promise<void> {
    await this.client.send(new InvokeCommand({ FunctionName: this.functionName, InvocationType: 'Event', Payload: new TextEncoder().encode(JSON.stringify({ versionId })) }));
  }
}

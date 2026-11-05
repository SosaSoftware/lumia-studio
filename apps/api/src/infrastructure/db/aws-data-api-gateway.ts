import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RDSDataClient,
  RollbackTransactionCommand,
} from '@aws-sdk/client-rds-data';
import type {
  BeginTransactionCommandInput,
  BeginTransactionCommandOutput,
  CommitTransactionCommandInput,
  CommitTransactionCommandOutput,
  ExecuteStatementCommandInput,
  ExecuteStatementCommandOutput,
  RollbackTransactionCommandInput,
  RollbackTransactionCommandOutput,
} from '@aws-sdk/client-rds-data';
import type { DataApiGateway } from './data-api-gateway.ts';

/**
 * Waits between attempts while a paused Aurora Serverless v2 cluster resumes. AWS documents a resume of about
 * 15 seconds; the total (20 s) stays inside the 30 s that AppSync waits for a resolver.
 */
export const RESUME_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 3000, 4000, 5000, 5000];

/** The Data API cancels the request while the cluster resumes and asks to retry in a few seconds. */
function isResuming(error: unknown): boolean {
  return error instanceof Error && error.name === 'DatabaseResumingException';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `DataApiGateway` backed by the AWS SDK client; a request that finds the cluster paused is retried while it resumes. */
export class AwsDataApiGateway implements DataApiGateway {
  public constructor(
    private readonly client: RDSDataClient = new RDSDataClient({}),
    private readonly retryDelaysMs: readonly number[] = RESUME_RETRY_DELAYS_MS,
  ) {}

  public executeStatement(input: ExecuteStatementCommandInput): Promise<ExecuteStatementCommandOutput> {
    return this.send(() => this.client.send(new ExecuteStatementCommand(input)));
  }

  public beginTransaction(input: BeginTransactionCommandInput): Promise<BeginTransactionCommandOutput> {
    return this.send(() => this.client.send(new BeginTransactionCommand(input)));
  }

  public commitTransaction(input: CommitTransactionCommandInput): Promise<CommitTransactionCommandOutput> {
    return this.send(() => this.client.send(new CommitTransactionCommand(input)));
  }

  public rollbackTransaction(input: RollbackTransactionCommandInput): Promise<RollbackTransactionCommandOutput> {
    return this.send(() => this.client.send(new RollbackTransactionCommand(input)));
  }

  private async send<T>(request: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await request();
      } catch (error) {
        const delay = this.retryDelaysMs[attempt];
        if (!isResuming(error) || delay === undefined) throw error;
        await wait(delay);
      }
    }
  }
}

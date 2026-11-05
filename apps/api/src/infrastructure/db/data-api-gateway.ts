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

/** The RDS Data API operations used by `DataApiDatabase`; tests replace it with a fake. */
export interface DataApiGateway {
  executeStatement(input: ExecuteStatementCommandInput): Promise<ExecuteStatementCommandOutput>;
  beginTransaction(input: BeginTransactionCommandInput): Promise<BeginTransactionCommandOutput>;
  commitTransaction(input: CommitTransactionCommandInput): Promise<CommitTransactionCommandOutput>;
  rollbackTransaction(input: RollbackTransactionCommandInput): Promise<RollbackTransactionCommandOutput>;
}

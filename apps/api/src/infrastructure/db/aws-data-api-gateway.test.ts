import type { RDSDataClient } from '@aws-sdk/client-rds-data';
import { describe, expect, it } from 'vitest';
import { AwsDataApiGateway } from './aws-data-api-gateway.ts';

function failure(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

/** A client whose answers are scripted: an Error is thrown, anything else is returned. */
function scriptedClient(answers: unknown[]): { client: RDSDataClient; calls: () => number } {
  let calls = 0;
  const client = {
    send: (): Promise<unknown> => {
      calls += 1;
      const answer = answers.shift();
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  // Only `send` is used by the gateway; the double keeps the test independent of the SDK client.
  return { client: client as unknown as RDSDataClient, calls: () => calls };
}

const INPUT = { resourceArn: 'arn:cluster', secretArn: 'arn:secret', sql: 'select 1' };

describe('AwsDataApiGateway', () => {
  it('retries while the paused cluster resumes', async () => {
    const { client, calls } = scriptedClient([failure('DatabaseResumingException'), failure('DatabaseResumingException'), { records: [] }]);
    await expect(new AwsDataApiGateway(client, [0, 0, 0]).executeStatement(INPUT)).resolves.toEqual({ records: [] });
    expect(calls()).toBe(3);
  });

  it('fails at once for other errors and after the last wait while resuming', async () => {
    const other = scriptedClient([failure('BadRequestException')]);
    await expect(new AwsDataApiGateway(other.client, [0, 0]).executeStatement(INPUT)).rejects.toThrow('BadRequestException');
    expect(other.calls()).toBe(1);
    const resuming = scriptedClient([failure('DatabaseResumingException'), failure('DatabaseResumingException')]);
    await expect(new AwsDataApiGateway(resuming.client, [0]).beginTransaction(INPUT)).rejects.toThrow('DatabaseResumingException');
    expect(resuming.calls()).toBe(2);
  });
});

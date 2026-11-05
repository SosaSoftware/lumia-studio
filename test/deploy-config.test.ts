import { readDeployConfig } from '../lib/deploy-config';

describe('deployment settings', () => {
  it('lets the database pause by default, between 0 and 1 ACU, after 5 minutes', () => {
    expect(readDeployConfig({})).toEqual({ env: {}, database: { minAcu: 0, maxAcu: 1, autoPauseMinutes: 5 }, lumiUrl: null, lumiRuntimeArn: null });
  });

  it('reads account, region, capacity and the Lumi URL from .env, before the CLI profile', () => {
    const config = readDeployConfig({
      LUMIA_AWS_ACCOUNT: '123456789012',
      CDK_DEFAULT_ACCOUNT: '999999999999',
      CDK_DEFAULT_REGION: 'us-east-2',
      LUMIA_DB_MIN_ACU: '0.5',
      LUMIA_DB_MAX_ACU: '4',
      LUMIA_DB_AUTO_PAUSE_MINUTES: '30',
      LUMIA_LUMI_URL: 'https://lumi.example.com/invocations',
      LUMIA_LUMI_RUNTIME_ARN: 'arn:aws:bedrock-agentcore:us-east-2:123456789012:runtime/lumi_agent-a1b2c3d4e5',
    });
    expect(config).toEqual({
      env: { account: '123456789012', region: 'us-east-2' },
      database: { minAcu: 0.5, maxAcu: 4, autoPauseMinutes: 30 },
      lumiUrl: 'https://lumi.example.com/invocations',
      lumiRuntimeArn: 'arn:aws:bedrock-agentcore:us-east-2:123456789012:runtime/lumi_agent-a1b2c3d4e5',
    });
    expect(readDeployConfig({ LUMIA_LUMI_URL: '/lumi/invocations' }).lumiUrl).toBe('/lumi/invocations');
  });

  it('rejects capacities and URLs that Aurora or the web cannot use', () => {
    expect(() => readDeployConfig({ LUMIA_DB_MAX_ACU: '0' })).toThrow(/LUMIA_DB_MAX_ACU/);
    expect(() => readDeployConfig({ LUMIA_DB_MIN_ACU: '0.3' })).toThrow(/steps of 0.5/);
    expect(() => readDeployConfig({ LUMIA_DB_MIN_ACU: '2', LUMIA_DB_MAX_ACU: '1' })).toThrow(/greater than or equal/);
    expect(() => readDeployConfig({ LUMIA_DB_AUTO_PAUSE_MINUTES: '2' })).toThrow(/between 5 and 1440/);
    expect(() => readDeployConfig({ LUMIA_LUMI_URL: 'http://lumi.example.com' })).toThrow(/https/);
    expect(() => readDeployConfig({ LUMIA_AWS_ACCOUNT: '1234' })).toThrow(/12 digits/);
    expect(() => readDeployConfig({ LUMIA_LUMI_RUNTIME_ARN: 'not-an-arn' })).toThrow(/LUMIA_LUMI_RUNTIME_ARN/);
  });
});

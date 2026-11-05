import { CfnOutput, Duration, RemovalPolicy, Stack, Validations } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import { StudioFunction } from '../constructs/studio-function';

/**
 * The people of Lumia Studio: a Cognito user pool where an administrator creates each account (no self sign-up), and
 * the client the web signs in with. The token only identifies the person; Studio reads their role and access.
 */
export class LumiaStudioIdentityStack extends Stack {
  public readonly userPool: cognito.UserPool;
  /** Client of the web, also used by Lumi with the token of the person. */
  public readonly webClient: cognito.UserPoolClient;

  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, { ...props, terminationProtection: true });
    const preToken = new StudioFunction(this, 'PreTokenGeneration', {
      description: 'Adds the email of the person to the Cognito access token.',
      entry: 'apps/api/src/lambda/pre-token-generation.ts',
      handler: 'handler',
      memorySize: 256,
      timeout: Duration.seconds(5),
    });

    this.userPool = new cognito.UserPool(this, 'Users', {
      // Essentials is needed to add claims to access tokens (pre token generation V2).
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true, tempPasswordValidity: Duration.days(7) },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userInvitation: {
        emailSubject: 'Tu cuenta de Lumia Studio',
        emailBody: 'Hola. Tu cuenta de Lumia Studio está lista. Usuario: {username}. Contraseña temporal: {####}. La primera vez que entres elegirás una contraseña nueva.',
      },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.userPool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG, preToken.fn, cognito.LambdaVersion.V2_0);

    this.webClient = this.userPool.addClient('Web', {
      authFlows: { userSrp: true },
      generateSecret: false,
      disableOAuth: true,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(7),
      // Time to choose the new password of a first sign-in.
      authSessionValidity: Duration.minutes(10),
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'WebClientId', { value: this.webClient.userPoolClientId });

    Validations.of(this.userPool).acknowledge({ id: 'AwsSolutions-COG2', reason: 'MFA is not required for the MVP; the sign-in page has no MFA step yet.' });
    Validations.of(this.userPool).acknowledge({ id: 'AwsSolutions-COG3', reason: 'Threat protection needs the Plus feature plan; the MVP uses Essentials.' });
    Validations.of(this.userPool).acknowledge({ id: 'AwsSolutions-COG8', reason: 'Essentials covers what Studio uses (access token claims); Plus is left for after the MVP.' });
  }
}

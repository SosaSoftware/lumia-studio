import { Duration, RemovalPolicy, Validations } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

interface CommonProps {
  /** Keep the bucket and its objects when the stack is deleted; otherwise the stack empties and deletes it. */
  readonly retain: boolean;
}

/** A bucket that receives the access logs of other buckets and of CloudFront. */
export interface LogsBucketProps extends CommonProps {
  readonly kind: 'logs';
  /** Days the logs are kept. */
  readonly expireAfterDays: number;
}

/** A bucket with data or the files of the site. */
export interface ContentBucketProps extends CommonProps {
  readonly kind: 'content';
  /** Where S3 writes the access logs of this bucket, and under which prefix. */
  readonly accessLogs: s3.IBucket;
  readonly logPrefix: string;
  /** Keep earlier versions of each object (published classes). */
  readonly versioned?: boolean;
  readonly cors?: s3.CorsRule[];
}

export type PrivateBucketProps = LogsBucketProps | ContentBucketProps;

/**
 * An S3 bucket of Lumia Studio that is never public: S3-managed encryption, TLS 1.2 or later, every public access
 * blocked and access logs. Content buckets disable ACLs; the logs bucket keeps them because CloudFront writes its
 * logs with ACLs.
 */
export class PrivateBucket extends s3.Bucket {
  public constructor(scope: Construct, id: string, props: PrivateBucketProps) {
    const content = props.kind === 'content' ? props : undefined;
    super(scope, id, {
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: props.kind === 'logs' ? s3.ObjectOwnership.OBJECT_WRITER : s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: content?.versioned ?? false,
      ...(content === undefined ? {} : { serverAccessLogsBucket: content.accessLogs, serverAccessLogsPrefix: content.logPrefix }),
      ...(content?.cors === undefined ? {} : { cors: content.cors }),
      lifecycleRules: props.kind === 'logs' ? [{ expiration: Duration.days(props.expireAfterDays) }] : [],
      removalPolicy: props.retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.retain,
    });
    if (props.kind === 'logs') {
      Validations.of(this).acknowledge({ id: 'AwsSolutions-S1', reason: 'This bucket receives the access logs; logging it to itself would loop.' });
    }
  }
}

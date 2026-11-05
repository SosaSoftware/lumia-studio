import { GraphQLScalarType, Kind } from 'graphql';
import type { GraphQLScalarTypeConfig, ValueNode } from 'graphql';

/** SDL of the scalars and directives that AppSync provides out of the box. */
export const AWS_DEFINITIONS_SDL = `
scalar AWSDateTime
scalar AWSDate
scalar AWSJSON
scalar AWSEmail

directive @aws_cognito_user_pools(cognito_groups: [String]) on OBJECT | FIELD_DEFINITION
directive @aws_iam on OBJECT | FIELD_DEFINITION
directive @aws_subscribe(mutations: [String]) on FIELD_DEFINITION
`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function literalText(node: ValueNode, scalar: string): string {
  if (node.kind !== Kind.STRING) {
    throw new TypeError(`${scalar} must be a string.`);
  }
  return node.value;
}

/** Scalar whose wire format is a validated string. */
function textScalar(name: string, validate: (value: string) => void): GraphQLScalarType<string, string> {
  const check = (value: unknown): string => {
    if (typeof value !== 'string') {
      throw new TypeError(`${name} must be a string.`);
    }
    validate(value);
    return value;
  };
  const config: GraphQLScalarTypeConfig<string, string> = {
    name,
    coerceOutputValue: (value) => (value instanceof Date ? value.toISOString() : check(value)),
    coerceInputValue: check,
    coerceInputLiteral: (node) => check(literalText(node, name)),
  };
  return new GraphQLScalarType(config);
}

function requireJson(value: string): void {
  try {
    JSON.parse(value);
  } catch (error) {
    throw new TypeError('AWSJSON must contain valid JSON text.', { cause: error });
  }
}

function parseJsonText(value: string): unknown {
  requireJson(value);
  const parsed: unknown = JSON.parse(value);
  return parsed;
}

/**
 * Like AppSync: clients send `AWSJSON` as JSON text and resolvers receive the parsed value; resolvers return a JSON
 * value and clients receive its JSON text. A resolver that returns a string gets it encoded again, as in AppSync.
 */
function jsonScalar(): GraphQLScalarType<unknown, string> {
  const config: GraphQLScalarTypeConfig<unknown, string> = {
    name: 'AWSJSON',
    coerceOutputValue: (value) => JSON.stringify(value),
    coerceInputValue: (value) => {
      if (typeof value !== 'string') {
        throw new TypeError('AWSJSON must be a string with JSON text.');
      }
      return parseJsonText(value);
    },
    coerceInputLiteral: (node) => parseJsonText(literalText(node, 'AWSJSON')),
  };
  return new GraphQLScalarType(config);
}

/** Runtime implementations of the AppSync scalars. */
export function awsScalars(): Record<string, GraphQLScalarType> {
  return {
    AWSDateTime: textScalar('AWSDateTime', (value) => {
      if (Number.isNaN(Date.parse(value))) {
        throw new TypeError('AWSDateTime must be an ISO 8601 date-time.');
      }
    }),
    AWSDate: textScalar('AWSDate', (value) => {
      if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
        throw new TypeError('AWSDate must be an ISO 8601 date.');
      }
    }),
    AWSEmail: textScalar('AWSEmail', (value) => {
      if (!EMAIL_PATTERN.test(value)) {
        throw new TypeError('AWSEmail must be an email address.');
      }
    }),
    AWSJSON: jsonScalar(),
  };
}

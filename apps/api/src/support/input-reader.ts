import { AppError } from '../shared/errors/index.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Typed access to GraphQL arguments and input objects; every failure is a `ValidationError` that names the field. */
export class InputReader {
  public constructor(
    private readonly values: JsonRecord,
    private readonly label = '',
  ) {}

  public string(name: string): string {
    const value = this.values[name];
    if (typeof value !== 'string') {
      throw this.invalid(name, 'debe ser un texto');
    }
    return value;
  }

  /** Reads a UUID; an invalid one is a validation error instead of a database error. */
  public id(name: string): string {
    const value = this.string(name);
    if (!UUID.test(value)) {
      throw this.invalid(name, 'no es un identificador válido');
    }
    return value;
  }

  public optionalId(name: string): string | undefined {
    const value = this.values[name];
    return value === undefined || value === null ? undefined : this.id(name);
  }

  public ids(name: string): string[] {
    return this.strings(name).map((value, index) => {
      if (!UUID.test(value)) {
        throw this.invalid(`${name}[${String(index)}]`, 'no es un identificador válido');
      }
      return value;
    });
  }

  public optionalString(name: string): string | undefined {
    const value = this.values[name];
    return value === undefined || value === null ? undefined : this.string(name);
  }

  public number(name: string): number {
    const value = this.values[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.invalid(name, 'debe ser un número');
    }
    return value;
  }

  public optionalNumber(name: string): number | undefined {
    const value = this.values[name];
    return value === undefined || value === null ? undefined : this.number(name);
  }

  public optionalInteger(name: string): number | undefined {
    const value = this.optionalNumber(name);
    if (value !== undefined && !Number.isInteger(value)) {
      throw this.invalid(name, 'debe ser un número entero');
    }
    return value;
  }

  public object(name: string): InputReader {
    const value = this.values[name];
    if (!isRecord(value)) {
      throw this.invalid(name, 'debe ser un objeto');
    }
    return new InputReader(value, this.path(name));
  }

  public optionalObject(name: string): InputReader | undefined {
    const value = this.values[name];
    return value === undefined || value === null ? undefined : this.object(name);
  }

  public objects(name: string): InputReader[] {
    const value = this.values[name];
    if (!Array.isArray(value)) {
      throw this.invalid(name, 'debe ser una lista');
    }
    return value.map((item: unknown, index) => {
      if (!isRecord(item)) {
        throw this.invalid(`${name}[${String(index)}]`, 'debe ser un objeto');
      }
      return new InputReader(item, this.path(`${name}[${String(index)}]`));
    });
  }

  public strings(name: string): string[] {
    const value = this.values[name];
    if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
      throw this.invalid(name, 'debe ser una lista de textos');
    }
    return value;
  }

  /** Reads an `AWSJSON` value: AppSync delivers a JSON string, other transports may deliver the parsed value. */
  public json(name: string): unknown {
    const value = this.values[name];
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch (error) {
      throw new AppError('ValidationError', `${this.path(name)}: no es un JSON válido.`, { cause: error });
    }
  }

  private path(name: string): string {
    return this.label === '' ? name : `${this.label}.${name}`;
  }

  private invalid(name: string, reason: string): AppError {
    return AppError.validation(`${this.path(name)}: ${reason}.`);
  }
}

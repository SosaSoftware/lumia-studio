/** Raised when a configuration value is missing or invalid. */
export class ConfigError extends Error {
  public constructor(
    public readonly variable: string,
    message: string,
  ) {
    super(`${variable}: ${message}`);
    this.name = 'ConfigError';
  }
}

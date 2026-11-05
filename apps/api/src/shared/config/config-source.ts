/** Strategy that provides raw configuration values by name. */
export interface ConfigSource {
  get(name: string): string | undefined;
}

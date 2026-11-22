export interface FlagshipBinding {
  getStringValue(key: string, defaultValue: string): Promise<string>;
  getNumberValue(key: string, defaultValue: number): Promise<number>;
}

export async function loadConfig<T extends object>(
  env: T,
  fallbacks: Record<string, string>,
): Promise<T> {
  const flags = (env as unknown as { TEST_FLAGS?: FlagshipBinding }).TEST_FLAGS;
  if (!flags) return env;

  const resolved = { ...env } as Record<string, unknown>;
  await Promise.all(
    Object.entries(fallbacks).map(async ([key, fallback]) => {
      const current = resolved[key];
      const base = typeof current === 'string' ? current : fallback;
      try {
        resolved[key] = await flags.getStringValue(key, base);
      } catch (error) {
        console.error(`[config] Flagship read failed for ${key}`, error);
      }
    }),
  );
  return resolved as unknown as T;
}

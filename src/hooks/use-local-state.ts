import { useEffect, useState } from "react";
import type { ZodType, ZodTypeDef } from "zod";

export function useLocalState<T>(
  key: string,
  fallback: T,
  schema: ZodType<T, ZodTypeDef, unknown>,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const result = schema.safeParse(
        JSON.parse(localStorage.getItem(key) ?? "null"),
      );
      return result.success ? result.data : fallback;
    } catch {
      return fallback;
    }
  });
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [key, value]);
  return [value, setValue, saved] as const;
}

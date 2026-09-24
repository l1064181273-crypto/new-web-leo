import { useCallback, useEffect, useRef, useState } from "react";
import type { ZodType, ZodTypeDef } from "zod";

export function useLocalState<T>(
  key: string,
  fallback: T,
  schema: ZodType<T, ZodTypeDef, unknown>,
) {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { value: fallback, recoveryRaw: null, readFailed: false, raw };
      try {
        const result = schema.safeParse(JSON.parse(raw));
        return result.success
          ? { value: result.data, recoveryRaw: null, readFailed: false, raw }
          : { value: fallback, recoveryRaw: raw, readFailed: false, raw };
      } catch {
        return { value: fallback, recoveryRaw: raw, readFailed: false, raw };
      }
    } catch {
      return { value: fallback, recoveryRaw: null, readFailed: true, raw: undefined };
    }
  });
  const [value, setValue] = useState<T>(initial.value);
  const [saved, setSaved] = useState(!initial.readFailed && initial.recoveryRaw === null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<"read-failed" | "conflict" | null>(initial.readFailed ? "read-failed" : null);
  const blocked = useRef(failure);
  const baseline = useRef(initial.raw);
  const recovery = useRef(initial.recoveryRaw);

  const keepInMemory = useCallback((reason: "read-failed" | "conflict") => {
    if (blocked.current) return;
    blocked.current = reason;
    setFailure(reason);
    setSaved(false);
  }, []);
  const verifyBaseline = useCallback(() => {
    if (blocked.current) return false;
    try {
      // Compare the exact stored text, including deletion or incompatible data.
      // Do not merge or replace an editor's current in-memory value.
      if (localStorage.getItem(key) !== baseline.current) {
        keepInMemory("conflict");
        return false;
      }
      return true;
    } catch {
      keepInMemory("read-failed");
      return false;
    }
  }, [key, keepInMemory]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (blocked.current || (event.key !== null && event.key !== key)) return;
      try {
        if (event.storageArea && event.storageArea !== localStorage) return;
        verifyBaseline();
      } catch {
        keepInMemory("read-failed");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, verifyBaseline, keepInMemory]);

  useEffect(() => {
    // A failed read or an external edit locks only this mount to memory mode.
    // Reopening reads the latest stored value; editing here never clears the lock.
    if (blocked.current) return;
    try {
      const raw = JSON.stringify(value);
      if (raw === undefined) throw new TypeError("Local state is not serializable");
      if (!verifyBaseline()) return;
      // Preserve incompatible or malformed data before replacing it. If there is
      // not enough storage to keep a recovery copy, the original stays untouched.
      if (recovery.current !== null) {
        const backupKey = `${key}:recovery:${crypto.randomUUID()}`;
        localStorage.setItem(backupKey, recovery.current);
        setRecoveryKey(backupKey);
        recovery.current = null;
        if (!verifyBaseline()) return;
      }
      // localStorage has no compare-and-set transaction: this pre-write check
      // prevents stale sequential writes, not truly simultaneous cross-tab writes.
      localStorage.setItem(key, raw);
      baseline.current = raw;
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [key, value, verifyBaseline]);
  return [value, setValue, saved, { recoveryRaw: initial.recoveryRaw, recoveryKey, readFailed: failure === "read-failed", conflict: failure === "conflict" }] as const;
}

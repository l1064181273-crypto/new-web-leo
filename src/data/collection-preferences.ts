export type CollectionRecovery = { recoveryRaw: string | null; recoveryKey: string | null; readFailed?: boolean; conflict?: boolean };

// Normalize only on an explicit user change. Old unknown IDs and duplicates
// cannot make a new favorite exceed the persisted schema's 100-entry limit.
export function toggleSavedId<T extends string | number>(previous: T[], id: T, allowed: readonly T[]): T[] {
  const known = new Set(allowed);
  const current = [...new Set(previous)].filter(value => known.has(value));
  if (!known.has(id)) return current;
  return current.includes(id) ? current.filter(value => value !== id) : [...current, id];
}

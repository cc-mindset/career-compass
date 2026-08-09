const STORAGE_KEY = 'clarity-user-id';

/** Stable demo user id for history API until Clerk auth is wired. */
export function getClarityUserId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `clarity-${crypto.randomUUID()}`
        : `clarity-${Date.now()}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return 'clarity-local-user';
  }
}

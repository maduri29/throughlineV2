// Storage durability.
//
// IndexedDB defaults to "best-effort": under storage pressure a browser may
// evict it without warning or user action. For an app whose entire premise is
// that your work lives on your own machine, best-effort is the wrong bucket --
// `navigator.storage.persist()` moves the origin to "persistent", after which
// data is only removed if the user removes it deliberately.
//
// Worth being precise about what this does NOT do: it is not a backup. Clearing
// site data, using a private window, or losing the machine still loses the
// work. Only the JSON envelope (data/envelope.ts) is a backup.

export type Durability = {
  /** True once the origin is in the persistent bucket. */
  persisted: boolean;
  /** Whether the browser exposes the Storage API at all (Safari lagged here). */
  supported: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
};

/**
 * Ask for persistent storage, then report where we ended up.
 *
 * Chromium usually grants this silently based on engagement heuristics rather
 * than prompting, and may refuse on a first visit — so a `false` here is normal
 * and not an error state. Re-asking on a later boot can succeed.
 */
export async function requestDurableStorage(): Promise<Durability> {
  const s = navigator.storage as StorageManager | undefined;
  if (!s || typeof s.persisted !== "function") {
    return { persisted: false, supported: false, usageBytes: null, quotaBytes: null };
  }

  let persisted = false;
  try {
    persisted = await s.persisted();
    if (!persisted && typeof s.persist === "function") persisted = await s.persist();
  } catch {
    // A denied or unavailable permission must never stop the app booting.
    persisted = false;
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (typeof s.estimate === "function") {
      const est = await s.estimate();
      usageBytes = est.usage ?? null;
      quotaBytes = est.quota ?? null;
    }
  } catch {
    /* estimate is advisory only */
  }

  return { persisted, supported: true, usageBytes, quotaBytes };
}

/** Compact human form for the header indicator, e.g. "1.2 MB of 61 GB". */
export function describeUsage(d: Durability): string | null {
  if (d.usageBytes === null) return null;
  const fmt = (b: number): string => {
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = b;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
  };
  return d.quotaBytes ? `${fmt(d.usageBytes)} of ${fmt(d.quotaBytes)}` : fmt(d.usageBytes);
}

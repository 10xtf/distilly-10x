import type { Clock } from "../defaults/system-clock.js";
import { SystemClock } from "../defaults/system-clock.js";
import type { Layout } from "../layout.js";
import { FileLock } from "./file-lock.js";
import type { FileLockLease } from "./file-lock.js";

/** Cross-process lock for inline-space kind-and-label resolution. */
export class FileSpaceCatalogLock {
  private readonly layout: Layout;
  private readonly clock: Clock;

  /**
   * Creates the space-catalog lock factory for one fact layout.
   *
   * @param layout - Confined local fact layout.
   * @param clock - Clock used by the underlying file-lock lease.
   */
  constructor(layout: Layout, clock: Clock = new SystemClock()) {
    this.layout = layout;
    this.clock = clock;
  }

  /**
   * Acquires the one root spaces catalog lock.
   *
   * @returns A held catalog-lock lease.
   */
  acquire(): Promise<FileLockLease> {
    return new FileLock(this.layout.root, this.layout.spaceCatalogLock(), this.clock).acquire();
  }
}

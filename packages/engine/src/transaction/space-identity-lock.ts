import type { SpaceId } from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import { SystemClock } from "../defaults/system-clock.js";
import type { Layout } from "../layout.js";
import { FileLock } from "./file-lock.js";
import type { FileLockLease } from "./file-lock.js";

/** Cross-process identity lock scoped to one space. */
export class FileSpaceIdentityLock {
  private readonly layout: Layout;
  private readonly clock: Clock;

  /**
   * Creates the lock service for one fact layout.
   *
   * @param layout - Confined fact-layout paths.
   * @param clock - Clock used by owner heartbeats and stale recovery.
   */
  constructor(layout: Layout, clock: Clock = new SystemClock()) {
    this.layout = layout;
    this.clock = clock;
  }

  /**
   * Acquires the identity lock for one space.
   *
   * @param spaceId - Space whose identity scan will be serialized.
   * @returns The owner-bound lock lease.
   */
  acquire(spaceId: SpaceId): Promise<FileLockLease> {
    return new FileLock(
      this.layout.root,
      this.layout.spaceIdentityLock(spaceId),
      this.clock,
    ).acquire();
  }
}

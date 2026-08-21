import type { EngineClient, LibraryPage } from "@distilly/protocol";

/**
 * Discards all page cursors and completes the three Panel-wide recovery reads.
 *
 * @param client - Browser HTTP client whose query overload performs the reread.
 * @returns Completion after library, review, and doctor reads all validate.
 */
export const fullPanelReread = async (client: EngineClient): Promise<void> => {
  const readLibrary = async (): Promise<void> => {
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page: LibraryPage = await client.call("library.list", {
        limit: 200,
        ...(cursor === undefined ? {} : { cursor }),
      });
      cursor = page.nextCursor;
      if (cursor !== undefined) {
        if (seen.has(cursor)) throw new Error("Panel library cursor repeated during full reread.");
        seen.add(cursor);
      }
    } while (cursor !== undefined);
  };
  const readReviews = async (): Promise<void> => {
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await client.call("reviews.list", {
        limit: 200,
        ...(cursor === undefined ? {} : { cursor }),
      });
      cursor = page.nextCursor;
      if (cursor !== undefined) {
        if (seen.has(cursor)) throw new Error("Panel review cursor repeated during full reread.");
        seen.add(cursor);
      }
    } while (cursor !== undefined);
  };
  await Promise.all([readLibrary(), readReviews(), client.call("system.doctor", {})]);
};

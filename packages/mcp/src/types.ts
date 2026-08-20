import type { EngineClient, ReviewLaunch, ReviewRef } from "@distilly/protocol";

/** Opens or reuses the local review surface for one suspended candidate. */
export interface ReviewPresenter {
  /**
   * Presents one immutable review reference.
   *
   * @param review - Candidate selected by the engine.
   * @returns A launch target for exactly the same candidate.
   */
  present(review: ReviewRef): Promise<ReviewLaunch>;
}

/** Dependencies for the transport-neutral five-tool presenter. */
export interface McpServerOptions {
  readonly client: EngineClient;
  readonly reviewPresenter: ReviewPresenter;
}

/** Transport-neutral server handle. It does not own the injected EngineClient. */
export interface McpServer {
  /**
   * Stops transports owned by this server handle.
   *
   * @returns Completion after the server is closed.
   */
  close(): Promise<void>;
}

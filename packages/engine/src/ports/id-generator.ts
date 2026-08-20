import type { EventId, JobId, SpaceId, SubjectId } from "@distilly/protocol";

/** Random id seam used by the Step 5 atomic-ingest composition. */
export interface IdGenerator {
  subjectId(): SubjectId;
  spaceId(): SpaceId;
  jobId(): JobId;
  eventId(): EventId;
}

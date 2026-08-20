import { randomBytes } from "node:crypto";

import type {
  CaptureAuditRef,
  EventId,
  JobId,
  LeaseId,
  RequestId,
  SpaceId,
  SubjectId,
} from "@distilly/protocol";

/** Random identifier seam used by deterministic engine tests. */
interface IdGenerator {
  subjectId(): SubjectId;
  spaceId(): SpaceId;
  jobId(): JobId;
  leaseId(): LeaseId;
  requestId(): RequestId;
  eventId(): EventId;
  captureAuditRef(): CaptureAuditRef;
}

const random128 = (): string => randomBytes(16).toString("hex");

/** Production 128-bit cryptographic identifier generator. */
export class CryptoIdGenerator implements IdGenerator {
  /**
   * Generates an opaque subject id.
   *
   * @returns A fresh 128-bit subject identifier.
   */
  subjectId(): SubjectId {
    return `subject_${random128()}` as SubjectId;
  }

  /**
   * Generates an opaque space id.
   *
   * @returns A fresh 128-bit space identifier.
   */
  spaceId(): SpaceId {
    return `space_${random128()}` as SpaceId;
  }

  /**
   * Generates an opaque job id.
   *
   * @returns A fresh 128-bit job identifier.
   */
  jobId(): JobId {
    return `job_${random128()}` as JobId;
  }

  /**
   * Generates an opaque lease id.
   *
   * @returns A fresh 128-bit lease identifier.
   */
  leaseId(): LeaseId {
    return `lease_${random128()}` as LeaseId;
  }

  /**
   * Generates a caller-safe mutation id.
   *
   * @returns A fresh 128-bit request identifier.
   */
  requestId(): RequestId {
    return `req_${random128()}` as RequestId;
  }

  /**
   * Generates an opaque event id.
   *
   * @returns A fresh 128-bit event identifier.
   */
  eventId(): EventId {
    return `event_${random128()}` as EventId;
  }

  /**
   * Generates an unguessable private-capture audit reference.
   *
   * @returns A fresh 128-bit capture-audit reference.
   */
  captureAuditRef(): CaptureAuditRef {
    return `capture_${random128()}` as CaptureAuditRef;
  }
}

// An ingest error that will happen again no matter how often we retry
// (scanned PDF, password, damaged file, too many pages). The worker marks the
// document failed straight away instead of wasting retries. The message is
// shown to the user, so write it for them.
export class PermanentIngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentIngestError";
  }
}

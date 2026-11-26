import { LiveImagePreparationError } from "./invoice-live-images";
import { LiveReaderError } from "./invoice-live-reader";
import {
  liveReadingFailure,
  normalizeLiveReadingFailure,
} from "./live-reading-failure";

/** Never retain arbitrary exception messages or reader-provided error objects. */
export function failureFromLiveReadingCause(cause: unknown, timedOut = false) {
  if (timedOut) return liveReadingFailure("timeout");
  if (cause instanceof LiveReaderError && cause.diagnostic)
    return normalizeLiveReadingFailure(cause.diagnostic);
  if (cause instanceof LiveImagePreparationError) {
    try {
      return normalizeLiveReadingFailure({ reason: cause.code });
    } catch {
      // A newer preparation code never grants permission to retain its text.
    }
  }
  return liveReadingFailure("unknown");
}

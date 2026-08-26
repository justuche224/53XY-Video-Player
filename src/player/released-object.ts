/**
 * Did this error come from touching an expo shared object after its release?
 *
 * `SharedObject.release()` "detaches the JS and native objects … any subsequent
 * calls to native functions of the object will throw", and objects from
 * `useVideoPlayer()` are released in the effect cleanup phase — i.e. whenever
 * `uri` changes or the screen unmounts. There is no `isReleased` flag to test
 * beforehand, so the throw is the only available signal.
 *
 * Matching on the message is unlovely, but it is deliberately narrow: anything
 * that isn't a release complaint must stay loud.
 */
export function isReleasedObjectError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return message.includes('already released');
}

/**
 * Run `fn`, swallowing the throw only if it came from a released object.
 *
 * Every player gesture callback reaches JS through `scheduleOnRN`, so it can
 * land after the screen unmounted and released the player: leaving a video
 * mid-hold, mid-scrub, or mid double-tap is enough. The work is moot at that
 * point — the player is gone and so is the UI it would have updated — but the
 * throw still surfaces as a redbox. Anything that isn't a release complaint
 * rethrows.
 */
export function ignoreIfReleased(fn: () => void, label?: string): void {
  try {
    fn();
  } catch (err) {
    if (!isReleasedObjectError(err)) throw err;
    // A guard that swallows silently is a guard you can't tell is working.
    // The label is the only way to know which callback lost the race, and a
    // negative result ("no warning on back-out") is itself the answer.
    if (__DEV__) console.warn(`[released-object] swallowed in ${label ?? 'unlabelled'}`);
  }
}

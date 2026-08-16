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

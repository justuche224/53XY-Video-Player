import { isReleasedObjectError } from '../released-object';

describe('isReleasedObjectError', () => {
  // The exact shape Android threw when a long-press ended after the player
  // had been released: the cast failure is the surface error, the release is
  // the cause, and both arrive in one message string.
  it('recognises the chained cast-failure message from a released player', () => {
    const err = new Error(
      'The 1st argument cannot be cast to type class expo.modules.video.player.VideoPlayer ' +
        '(received class java.lang.Integer)\n' +
        '→ Caused by: Cannot use shared object that was already released',
    );
    expect(isReleasedObjectError(err)).toBe(true);
  });

  it('recognises the bare released-object message', () => {
    expect(
      isReleasedObjectError(new Error('Cannot use shared object that was already released')),
    ).toBe(true);
  });

  // Anything else must stay loud — swallowing real bugs is worse than the crash.
  it('does not match an unrelated error', () => {
    expect(isReleasedObjectError(new TypeError('player.playbackRate is not a function'))).toBe(
      false,
    );
  });

  it('handles a thrown non-Error value without blowing up', () => {
    expect(isReleasedObjectError('already released')).toBe(true);
    expect(isReleasedObjectError(null)).toBe(false);
  });
});

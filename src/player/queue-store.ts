// In-memory handoff for ad-hoc playback queues built from a multi-selection.
//
// The ids don't travel as a route param: selecting every group on Home is
// hundreds of ids, and expo-router serializes params into the URL. Instead the
// caller stashes the queue here and passes the returned token to /player.
//
// Only the most recent queue is kept — one player screen is alive at a time,
// and it holds its token for the whole session (it swaps videos via
// router.setParams, which keeps the same screen instance). The store dies with
// the app, which is correct for an ad-hoc queue: a restored player falls back
// to its groupKey.

let currentToken: string | null = null;
let currentIds: string[] = [];
let counter = 0;

/** Stash a queue and return the token that reads it back. */
export function stashQueue(ids: string[]): string {
  counter += 1;
  currentToken = `q${counter}`;
  currentIds = [...ids];
  return currentToken;
}

/** Read a stashed queue back, or null if the token isn't the current one. */
export function getQueue(token: string): string[] | null {
  if (token !== currentToken) return null;
  return currentIds;
}

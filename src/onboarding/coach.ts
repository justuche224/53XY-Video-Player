export function shouldShowPlayerCard(dismissed: boolean, onboardingDone: boolean): boolean {
  return onboardingDone && !dismissed;
}

/**
 * The hint waits for the second Home visit. On the first the library is often
 * still scanning and the user is busy reading their own file names — a tip
 * competing with that is a tip nobody reads.
 */
export function shouldShowHomeHint(dismissed: boolean, visitCount: number): boolean {
  return !dismissed && visitCount >= 2;
}

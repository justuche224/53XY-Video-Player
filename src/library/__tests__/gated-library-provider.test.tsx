import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ReactNode } from 'react';

import type { OnboardingStatus } from '@/onboarding/policy';
import { GatedLibraryProvider } from '../gated-library-provider';

const mockUseOnboarding = jest.fn();
jest.mock('@/onboarding/onboarding-provider', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

// Captures every `autoRequest` value LibraryProvider was mounted/rendered
// with, in order, without pulling in its real SQLite/media-access deps.
// (Must be `mock`-prefixed: jest.mock factories may only reference
// out-of-scope bindings whose name starts with "mock".)
let mockAutoRequestCalls: boolean[];
jest.mock('../library-provider', () => ({
  LibraryProvider: ({ autoRequest }: { autoRequest: boolean; children: ReactNode }) => {
    mockAutoRequestCalls.push(autoRequest);
    return null;
  },
}));

function setOnboardingStatus(status: OnboardingStatus) {
  mockUseOnboarding.mockReturnValue({ status, complete: jest.fn(), restart: jest.fn() });
}

/**
 * These cover the actual hazard the fix in `shouldAutoRequestAfterTour`
 * depends on: `GatedLibraryProvider` sets `tourShownRef` inside a `useEffect`
 * (runs after commit) but reads it during render on the *next* render. If
 * that ordering ever broke — the ref read racing ahead of the effect that
 * sets it — a user who declined during the tour would get ambushed by the
 * automatic system dialog anyway the moment `status` reached `'done'`. The
 * predicate itself (`shouldAutoRequestAfterTour`) is covered by its own truth
 * table in `onboarding/__tests__/policy.test.ts`; this is about the sequencing
 * around it, not the predicate's arithmetic.
 */
describe('GatedLibraryProvider — auto-request sequencing', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockAutoRequestCalls = [];
  });

  afterEach(() => {
    act(() => {
      renderer.unmount();
    });
  });

  it('never auto-asks again this run once the tour was shown, even after status settles to done', () => {
    setOnboardingStatus('resolving');
    act(() => {
      renderer = create(<GatedLibraryProvider>{null}</GatedLibraryProvider>);
    });

    // The tour is shown — status passes through 'needed'. The effect that
    // flips `tourShownRef.current` fires on this commit.
    setOnboardingStatus('needed');
    act(() => {
      renderer.update(<GatedLibraryProvider>{null}</GatedLibraryProvider>);
    });
    expect(mockAutoRequestCalls.at(-1)).toBe(false);

    // Slide 6 -> Home: status flips to 'done'. This render must read the ref
    // the previous commit's effect already set — a stale read here is exactly
    // the ambush the fix exists to prevent.
    setOnboardingStatus('done');
    act(() => {
      renderer.update(<GatedLibraryProvider>{null}</GatedLibraryProvider>);
    });
    expect(mockAutoRequestCalls.at(-1)).toBe(false);
  });

  it('keeps the original automatic ask for a returning user who never sees the tour', () => {
    setOnboardingStatus('resolving');
    act(() => {
      renderer = create(<GatedLibraryProvider>{null}</GatedLibraryProvider>);
    });

    // Already onboarded: status resolves straight to 'done', never passing
    // through 'needed', so `tourShownRef` is never set.
    setOnboardingStatus('done');
    act(() => {
      renderer.update(<GatedLibraryProvider>{null}</GatedLibraryProvider>);
    });
    expect(mockAutoRequestCalls.at(-1)).toBe(true);
  });
});

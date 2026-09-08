import type { VideoPlayer } from 'expo-video';
import { useEffect, useRef } from 'react';

/**
 * Latest embedded subtitle line, in a ref rather than state.
 *
 * Cues change several times a second during dialogue, and the player screen is
 * already re-rendering ~1×/s from timeUpdate. Putting this in state would add a
 * re-render per cue for a value only ever read at the instant of a capture.
 */
export function useEmbeddedCue(player: VideoPlayer): { current: string } {
  const cueRef = useRef('');

  useEffect(() => {
    cueRef.current = '';
    const sub = player.addListener('subtitleCueChange', ({ text }) => {
      cueRef.current = text;
    });
    return () => sub.remove();
  }, [player]);

  return cueRef;
}

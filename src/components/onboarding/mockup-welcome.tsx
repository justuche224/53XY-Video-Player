// Purpose: the first impression is the product itself — Home, as it will look
// once the library is in: continue-watching hero, then the sorted grid.
import { View } from 'react-native';

import { PhoneScreen } from '@/components/onboarding/device-frame';
import { FauxGrid, FauxHero, type FauxCardData } from '@/components/onboarding/faux-home';

export const HOME_CARDS: FauxCardData[] = [
  { key: 'show', title: 'Show', meta: '3 videos', stills: ['sunset', 'night', 'forest'] },
  { key: 'trip', title: 'Trip 2025', meta: '12 videos', stills: ['desert', 'steel', 'neon'] },
  { key: 'lecture', title: 'Lecture 04', meta: 'Seminars', stills: ['steel'], duration: '1:12:08', percent: 0.35 },
  { key: 'clips', title: 'Clips', meta: '8 videos', stills: ['neon', 'sunset', 'desert'] },
  { key: 'day3', title: 'Trip 2025 · Day 3', meta: 'Camera', stills: ['forest'], duration: '20:30', percent: 0.59 },
  { key: 'demo', title: 'Product demo v2', meta: 'Downloads', stills: ['night'], duration: '04:12' },
];

export function MockupWelcome() {
  return (
    <PhoneScreen>
      <FauxHero still="night" overline="Continue · S01E02" title="Show" meta="18:04 left" />
      <View style={{ paddingTop: 4 }}>
        <FauxGrid cards={HOME_CARDS} />
      </View>
    </PhoneScreen>
  );
}

import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';

export default function OnboardingScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="display">53XY</AppText>
      </View>
    </Screen>
  );
}

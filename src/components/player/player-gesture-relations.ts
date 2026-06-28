import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { GestureType } from 'react-native-gesture-handler';

export type PlayerGestureRelations = RefObject<GestureType | undefined>[];

const PlayerGestureRelationsContext = createContext<PlayerGestureRelations | null>(null);

export const PlayerGestureRelationsProvider = PlayerGestureRelationsContext.Provider;

export function usePlayerGestureRelations() {
  return useContext(PlayerGestureRelationsContext);
}

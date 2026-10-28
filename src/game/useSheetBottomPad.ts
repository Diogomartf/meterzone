import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding for a menu sheet's scroll content. The sheet itself has no
 * bottom padding so lists scroll to its edge instead of being cut short above
 * it; the content clears the home indicator here instead.
 */
export function useSheetBottomPad() {
  const insets = useSafeAreaInsets();
  return { paddingBottom: Math.max(insets.bottom, 18) + 34 };
}

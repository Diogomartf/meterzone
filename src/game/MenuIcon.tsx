import { StyleSheet, View } from 'react-native';

import { GameColors } from '@/constants/gameTheme';

/** Three chunky rounded bars: the menu glyph inside the home menu tile. */
export function MenuIcon({ dark = false }: { dark?: boolean }) {
  const bar = [styles.bar, dark && styles.barDark];
  return (
    <View style={styles.icon}>
      <View style={bar} />
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    gap: 4,
  },
  bar: {
    width: 22,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GameColors.white,
    // A faint drop so the white reads on the bright face.
    shadowColor: '#0A2A70',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
  },
  /** Navy bars for pale tiles, where white would wash out. */
  barDark: {
    backgroundColor: '#1A2F6B',
    shadowOpacity: 0,
  },
});

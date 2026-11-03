import { StyleSheet, View } from 'react-native';

import { GameColors } from '@/constants/gameTheme';

/** Three chunky rounded bars: the menu glyph inside the home menu tile. */
export function MenuIcon() {
  return (
    <View style={styles.icon}>
      <View style={styles.bar} />
      <View style={styles.bar} />
      <View style={styles.bar} />
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
});

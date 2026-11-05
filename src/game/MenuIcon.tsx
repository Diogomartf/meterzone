import { StyleSheet, View } from 'react-native';

/** Three chunky rounded navy bars: the glyph inside the cyan menu tile. */
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
    backgroundColor: '#1A2F6B',
  },
});

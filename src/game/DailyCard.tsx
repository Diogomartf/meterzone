import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGT } from 'gt-react-native';

import { GameFonts } from '@/constants/gameTheme';

const CALENDAR = require('../../assets/images/daily-card-calendar.webp');
const CHEVRON_ICON = {
  ios: 'chevron.right',
  android: 'chevron_right',
  web: 'chevron_right',
} as const;

const NAVY = '#1A2F6B';

/** Home-screen card under PLAY that starts the daily challenge. */
export function DailyCard({ onPress }: { onPress: () => void }) {
  const gt = useGT();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shell, pressed && styles.shellPressed]}
      accessibilityRole="button"
      accessibilityLabel={gt('Daily challenge')}
    >
      <LinearGradient
        colors={['#F4FCFF', '#DDF3FF', '#C9EBFF']}
        style={styles.face}
      >
        <Image source={CALENDAR} style={styles.icon} contentFit="contain" />
        <View style={styles.divider} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {gt('Daily challenge')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {gt('A new challenge every day')}
          </Text>
        </View>
        <SymbolView
          name={CHEVRON_ICON}
          size={18}
          tintColor={NAVY}
          weight="heavy"
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: 22,
    // A cool lip under the face, and a soft drop onto the sky.
    backgroundColor: '#8DC3EC',
    paddingBottom: 5,
    shadowColor: '#0A2A70',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  shellPressed: {
    paddingBottom: 2,
    marginTop: 3,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  icon: {
    width: 52,
    height: 52,
  },
  divider: {
    width: 1.5,
    alignSelf: 'stretch',
    marginVertical: 4,
    backgroundColor: 'rgba(26,47,107,0.15)',
  },
  body: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: GameFonts.display,
    fontSize: 21,
    lineHeight: 26,
    color: NAVY,
  },
  subtitle: {
    fontFamily: GameFonts.soft,
    fontSize: 14,
    lineHeight: 18,
    color: NAVY,
  },
});

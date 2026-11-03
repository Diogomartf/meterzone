import { Image } from 'expo-image';
import { useGT } from 'gt-react-native';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { MainButton } from '@/game/MainButton';

const METER = require('../../assets/images/howto-meter.webp');
const STAR = require('../../assets/images/star.webp');
const HEART = require('../../assets/images/howto-heart.webp');
const COINS = require('../../assets/images/howto-coins.webp');

/**
 * The menu's "How to play" page: four rules, one short line each, in the
 * same tinted cards as the menu. Modes are explained by the Play mode sheet.
 */
export function HowToPlay({
  contentStyle,
  onPlay,
}: {
  /** Bottom padding for the home indicator, from the sheet. */
  contentStyle?: StyleProp<ViewStyle>;
  onPlay: () => void;
}) {
  const gt = useGT();
  const rules = [
    {
      art: METER,
      artStyle: styles.artMeter,
      tint: '#DDF0FF',
      text: gt('Tap when the meter is in the zone.'),
      // The core rule: a bigger card, so it reads first.
      lead: true,
    },
    {
      art: STAR,
      artStyle: styles.artStar,
      tint: '#FFF3CF',
      text: gt('Hit the center for a Perfect. Hits in a row build a combo.'),
    },
    {
      art: HEART,
      artStyle: styles.artHeart,
      tint: '#FFE3E3',
      text: gt('You have 3 hearts. Each miss costs one.'),
    },
    {
      art: COINS,
      artStyle: styles.artCoins,
      tint: '#DDF8F0',
      text: gt('Hits earn coins. Spend them on new skins.'),
    },
  ];
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.rules}>
        {rules.map((rule, i) => (
          <View
            key={i}
            style={[
              styles.rule,
              rule.lead && styles.ruleLead,
              { backgroundColor: rule.tint },
            ]}
            accessible
            accessibilityLabel={`${i + 1}. ${rule.text}`}
          >
            <View style={[styles.artSlot, rule.lead && styles.artSlotLead]}>
              <Image
                source={rule.art}
                style={rule.artStyle}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.ruleText, rule.lead && styles.ruleTextLead]}>
              {rule.text}
            </Text>
          </View>
        ))}
      </View>

      <MainButton label={gt("LET'S PLAY!")} size="large" onPress={onPlay} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: 28,
    paddingTop: 4,
  },
  rules: {
    gap: 12,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 96,
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: 22,
  },
  artSlot: {
    width: 78,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleLead: {
    minHeight: 184,
    paddingVertical: 14,
    paddingLeft: 14,
    gap: 16,
  },
  artSlotLead: {
    width: 112,
    height: 160,
  },
  artMeter: {
    width: 112,
    height: 160,
  },
  artStar: {
    width: 62,
    height: 58,
  },
  artHeart: {
    width: 60,
    height: 55,
  },
  artCoins: {
    width: 78,
    height: 51,
  },
  ruleText: {
    flex: 1,
    fontFamily: GameFonts.display,
    fontSize: 19,
    lineHeight: 24,
    color: GameColors.ink,
  },
  ruleTextLead: {
    fontSize: 23,
    lineHeight: 28,
  },
});

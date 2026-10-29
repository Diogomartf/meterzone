import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { playClick } from '@/game/useSounds';

/**
 * Colours per tone, top to bottom: the outline, the face (a light bevel band
 * along the top edge, then bright to deep), and the lip under the face that
 * the press pushes it into. `shadow` tints the drop shadow on the surface.
 */
const TONES = {
  blue: {
    outline: '#030A6E',
    face: ['#3FAAFD', '#3FAAFD', '#0A7BFD', '#0052F4', '#0040EC'],
    lip: '#0027CF',
    text: GameColors.white,
    textShadow: 'rgba(0,18,120,0.55)',
    shadow: '#7A4A00',
    shadowOpacity: 0.45,
  },
  green: {
    outline: GameColors.ink,
    face: ['#5BE35B', '#5BE35B', '#14D414', '#00CA00', '#00BC00'],
    lip: '#009C00',
    text: GameColors.white,
    textShadow: 'rgba(0,70,0,0.45)',
    shadow: GameColors.ink,
    shadowOpacity: 0.25,
  },
  gold: {
    outline: GameColors.ink,
    face: ['#FFE04A', '#FFE04A', '#FFD000', '#FFC500', '#FFBA00'],
    lip: '#E87000',
    text: GameColors.ink,
    textShadow: 'rgba(255,255,255,0.4)',
    shadow: GameColors.ink,
    shadowOpacity: 0.25,
  },
} as const;

/** Where the face colours change — the first two hold the bevel band. */
const FACE_STOPS = [0, 0.12, 0.2, 0.6, 1] as const;

/** Lip depth per size: how far the button sits up, and drops when pressed. */
const LIP = { small: 4, regular: 6, large: 7 } as const;

type MainButtonProps = {
  label: string;
  onPress: () => void;
  tone?: keyof typeof TONES;
  /**
   * `small` sizes to its label for tight rows like the home screen's; the
   * others stretch across their container. `large` is the home PLAY button.
   */
  size?: keyof typeof LIP;
  /** A second, smaller line under the label. */
  subtitle?: string;
  /** SF Symbol (with Android / web fallbacks) before the label. */
  icon?: SymbolViewProps['name'];
  /** Spinner beside the label, and presses ignored, while work is pending. */
  loading?: boolean;
  /** Outer layout only, like a max width. */
  style?: StyleProp<ViewStyle>;
  /** Click on press. Off where the action brings its own sound, like PLAY. */
  clickSound?: boolean;
};

/**
 * The app's main call to action: a chunky 3D pill whose face drops onto its
 * lip when pressed. Use one per screen or card; FlatButton covers the rest.
 */
export function MainButton({
  label,
  onPress,
  tone = 'blue',
  size = 'regular',
  subtitle,
  icon,
  loading,
  style,
  clickSound = true,
}: MainButtonProps) {
  const colors = TONES[tone];
  const lip = LIP[size];

  return (
    <Pressable
      // On press-in, so the click lands with the visual drop.
      onPressIn={clickSound ? playClick : undefined}
      onPress={onPress}
      disabled={loading}
      style={[
        styles.pressable,
        size === 'small' && styles.pressableSmall,
        { paddingBottom: lip },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      accessibilityState={{ busy: loading, disabled: loading }}
    >
      {({ pressed }) => (
        <>
          {/* The lip: a darker copy of the pill sitting `lip` below it. */}
          <View
            style={[
              styles.lip,
              {
                top: lip,
                borderColor: colors.outline,
                backgroundColor: colors.lip,
                shadowColor: colors.shadow,
                shadowOpacity: colors.shadowOpacity,
              },
            ]}
          />
          {/* Pressing drops the whole pill onto the lip, hiding it. */}
          <View
            style={[
              styles.shell,
              { borderColor: colors.outline },
              pressed && { transform: [{ translateY: lip }] },
            ]}
          >
            <LinearGradient
              colors={colors.face}
              locations={FACE_STOPS}
              style={[styles.face, FACE_SIZE[size]]}
            >
              <View style={styles.labelRow}>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : icon ? (
                  <SymbolView
                    name={icon}
                    size={LABEL_SIZE[size].fontSize * 0.85}
                    tintColor={colors.text}
                    weight="bold"
                  />
                ) : null}
                <Text
                  style={[
                    styles.label,
                    LABEL_SIZE[size],
                    { color: colors.text, textShadowColor: colors.textShadow },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {label}
                </Text>
              </View>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.text }]}>
                  {subtitle}
                </Text>
              ) : null}
            </LinearGradient>
          </View>
        </>
      )}
    </Pressable>
  );
}

const FACE_SIZE = StyleSheet.create({
  small: { minHeight: 36, paddingHorizontal: 16 },
  regular: { minHeight: 52, paddingHorizontal: 20 },
  large: { minHeight: 66, paddingHorizontal: 20, paddingVertical: 6 },
});

const LABEL_SIZE = StyleSheet.create({
  small: {
    fontSize: 16,
    lineHeight: 20,
    textShadowOffset: { width: 0, height: 1 },
  },
  regular: { fontSize: 22, lineHeight: 27 },
  large: { fontSize: 30, lineHeight: 34, letterSpacing: 1.5 },
});

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  pressableSmall: {
    alignSelf: 'auto',
    flexShrink: 1,
  },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 3,
    // A darker band on the surface below, so the button sits on it.
    shadowOffset: { width: 0, height: 3 },
    // No `elevation`: on Android it would draw the lip over the pill.
    shadowRadius: 1.5,
  },
  shell: {
    borderRadius: 999,
    borderWidth: 3,
    overflow: 'hidden',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flexShrink: 1,
    fontFamily: GameFonts.display,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  subtitle: {
    marginTop: 1,
    fontFamily: GameFonts.soft,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.8,
    opacity: 0.9,
  },
});

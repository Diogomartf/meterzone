import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
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
  /**
   * The home header coin badge's 3D look: gold face, thin gold outline, a
   * darker gold lip with no outline of its own, and a soft drop shadow.
   */
  gold: {
    outline: '#C98200',
    face: ['#FFE866', '#FFE866', '#FFD21F', '#FFC714', '#FFBE0B'],
    lip: '#D98A00',
    text: '#1A2F6B',
    textShadow: 'rgba(255,255,255,0.35)',
    shadow: '#0A2A70',
    shadowOpacity: 0.3,
    gloss: true,
    border: 2,
    lipBorder: 0,
    softShadow: true,
    /** A dark ring around the whole button, outside the gold edges. */
    outerOutline: '#0B1450',
  },
  /** Glossy white tile beside the menu one, holding the language flag. */
  white: {
    outline: '#4F6F96',
    face: ['#FFFFFF', '#FFFFFF', '#F6F9FC', '#EDF3F9', '#E5EEF7'],
    lip: '#9DB4CD',
    text: GameColors.ink,
    textShadow: 'rgba(255,255,255,0.4)',
    shadow: GameColors.ink,
    shadowOpacity: 0.3,
  },
  /** Pale cyan for the menu tile (home, game and game over), with a navy glyph. */
  cyan: {
    outline: '#1B5C9E',
    face: ['#D6F6FF', '#D6F6FF', '#A8EBFF', '#8FE2FB', '#7FDAF6'],
    lip: '#3FA6D6',
    text: GameColors.ink,
    textShadow: 'rgba(255,255,255,0.4)',
    shadow: GameColors.ink,
    shadowOpacity: 0.3,
  },
} as const;

/** Where the face colours change — the first two hold the bevel band. */
const FACE_STOPS = [0, 0.12, 0.2, 0.6, 1] as const;

/** Lip depth per size: how far the button sits up, and drops when pressed. */
const LIP = { small: 4, regular: 6, large: 7 } as const;

/** Shallower lip for the square tiles, which read chunkier than a pill. */
const SQUARE_LIP = { small: 1.5, regular: 2, large: 3 } as const;

/** Width of the dark ring some tones draw around the whole button. */
const OUTER_OUTLINE = 3.5;

/** Side of the square face when there's no label. */
const SQUARE = { small: 44, regular: 52, large: 64 } as const;

type MainButtonProps = {
  /** Visible text. Leave out for a square icon tile (the home menu button). */
  label?: string;
  /** Read out by screen readers; defaults to the label (and subtitle). */
  accessibilityLabel?: string;
  /** Custom content for a square icon tile, like the menu bars. */
  children?: ReactNode;
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
  accessibilityLabel,
  children,
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
  const square = label == null;
  const lip = square ? SQUARE_LIP[size] : LIP[size];
  const radius = square ? Math.round(SQUARE[size] * 0.38) : 999;

  return (
    <Pressable
      // On press-in, so the click lands with the visual drop.
      onPressIn={clickSound ? playClick : undefined}
      onPress={onPress}
      disabled={loading}
      style={[
        styles.pressable,
        (size === 'small' || square) && styles.pressableSmall,
        { paddingBottom: lip },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (subtitle ? `${label}. ${subtitle}` : label)
      }
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
                borderRadius: radius,
                borderColor: colors.outline,
                backgroundColor: colors.lip,
                ...('border' in colors && { borderWidth: colors.border }),
                ...('lipBorder' in colors && { borderWidth: colors.lipBorder }),
                ...('softShadow' in colors && styles.lipSoftShadow),
                shadowColor: colors.shadow,
                shadowOpacity: colors.shadowOpacity,
              },
              square && styles.lipSquare,
            ]}
          />
          {/* Pressing drops the whole pill onto the lip, hiding it. */}
          <View
            style={[
              styles.shell,
              { borderColor: colors.outline, borderRadius: radius },
              'border' in colors && { borderWidth: colors.border },
              pressed && { transform: [{ translateY: lip }] },
            ]}
          >
            <LinearGradient
              colors={colors.face}
              locations={FACE_STOPS}
              style={[
                styles.face,
                square
                  ? { width: SQUARE[size], height: SQUARE[size] }
                  : FACE_SIZE[size],
              ]}
            >
              {'gloss' in colors && colors.gloss && !square ? (
                // A soft white band across the top: the glossy highlight.
                <LinearGradient
                  colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.2)']}
                  style={styles.gloss}
                  pointerEvents="none"
                />
              ) : null}
              {square ? (
                (children ??
                (icon ? (
                  <SymbolView
                    name={icon}
                    size={Math.round(SQUARE[size] * 0.45)}
                    tintColor={colors.text}
                    weight="heavy"
                  />
                ) : null))
              ) : (
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
                      {
                        color: colors.text,
                        textShadowColor: colors.textShadow,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {label}
                  </Text>
                </View>
              )}
              {!square && subtitle ? (
                <Text style={[styles.subtitle, { color: colors.text }]}>
                  {subtitle}
                </Text>
              ) : null}
            </LinearGradient>
          </View>
          {'outerOutline' in colors ? (
            <View
              pointerEvents="none"
              style={[
                styles.outerOutline,
                {
                  borderColor: colors.outerOutline,
                  borderRadius: radius,
                  // Follows the face down when pressed, hugging the lip.
                  top: -OUTER_OUTLINE + (pressed ? lip : 0),
                },
              ]}
            />
          ) : null}
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
  outerOutline: {
    position: 'absolute',
    left: -OUTER_OUTLINE,
    right: -OUTER_OUTLINE,
    bottom: -OUTER_OUTLINE,
    borderWidth: OUTER_OUTLINE,
  },
  /** The coin badge's blurred drop, for tones that float rather than sit. */
  lipSoftShadow: {
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
  },
  /** Tiles sit flatter: a tighter, fainter shadow under the shallow lip. */
  lipSquare: {
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 1,
    shadowOpacity: 0.18,
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
  gloss: {
    position: 'absolute',
    top: 3,
    left: 16,
    right: 16,
    height: '32%',
    borderRadius: 999,
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

import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';

/**
 * `white` and `blue` sit on light or busy backgrounds with an ink outline;
 * `glass` is a see-through white for coloured cards like the support card.
 */
const TONES = {
  white: {
    face: GameColors.white,
    outline: GameColors.ink,
    text: GameColors.ink,
    pressed: '#EEF3F8',
  },
  blue: {
    face: GameColors.playBlue,
    outline: GameColors.ink,
    text: GameColors.white,
    pressed: GameColors.playBlueDark,
  },
  glass: {
    face: 'rgba(255,255,255,0.22)',
    outline: 'rgba(255,255,255,0.35)',
    text: GameColors.white,
    pressed: 'rgba(255,255,255,0.3)',
  },
} as const;

type FlatButtonProps = {
  onPress: () => void;
  /** Read out by screen readers; also the visible text unless icon-only. */
  accessibilityLabel: string;
  /** Visible text. Leave out for an icon-only square button. */
  label?: string;
  /** SF Symbol (with Android / web fallbacks), before the label or alone. */
  icon?: SymbolViewProps['name'];
  /** Custom content for an icon-only button, like a flag emoji. */
  children?: ReactNode;
  tone?: keyof typeof TONES;
  /** Side of an icon-only button. */
  size?: number;
  hitSlop?: number;
  /** Outer layout only, like `flex: 1`. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's secondary button: flat, outlined, and nudged down a touch when
 * pressed. With a label it's a full-width-friendly bar (GO HOME); without one
 * it's a square icon button (back, close, share). MainButton is the 3D one.
 */
export function FlatButton({
  onPress,
  accessibilityLabel,
  label,
  icon,
  children,
  tone = 'white',
  size = 44,
  hitSlop,
  style,
}: FlatButtonProps) {
  const colors = TONES[tone];
  const iconOnly = label == null;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        iconOnly
          ? {
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.32),
            }
          : styles.labelled,
        {
          backgroundColor: pressed ? colors.pressed : colors.face,
          borderColor: colors.outline,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      {children ??
        (icon ? (
          <SymbolView
            name={icon}
            size={iconOnly ? Math.round(size * 0.45) : 17}
            tintColor={colors.text}
            weight="bold"
          />
        ) : null)}
      {label != null ? (
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    overflow: 'hidden',
  },
  labelled: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
  label: {
    flexShrink: 1,
    fontFamily: GameFonts.body,
    fontSize: 18,
    lineHeight: 22,
  },
});

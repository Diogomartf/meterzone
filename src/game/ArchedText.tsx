import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

/** Tilt of the outermost letters, in degrees. */
const MAX_TILT = 8;
/** How far the outermost letters drop below the middle, as a share of font size. */
const DROP = 0.2;

type ArchedTextProps = {
  text: string;
  /** Text style for every letter; `fontSize` sets how deep the arch is. */
  style?: StyleProp<TextStyle>;
};

/**
 * A short headline bent over a gentle arch, like NEW BEST!: each letter is
 * tilted outwards and lowered toward the ends. Screen readers get it whole.
 */
export function ArchedText({ text, style }: ArchedTextProps) {
  const letters = Array.from(text);
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 40;
  const half = Math.max((letters.length - 1) / 2, 1);

  return (
    <View
      style={[styles.row, { paddingBottom: fontSize * DROP }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
    >
      {letters.map((letter, i) => {
        // -1 at the first letter, 0 in the middle, 1 at the last.
        const t = (i - (letters.length - 1) / 2) / half;
        return (
          <Text
            key={i}
            style={[
              style,
              {
                transform: [
                  { translateY: t * t * fontSize * DROP },
                  { rotate: `${t * MAX_TILT}deg` },
                ],
              },
            ]}
            importantForAccessibility="no"
          >
            {letter}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

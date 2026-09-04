import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, Text, View } from 'react-native';

import { GameColors } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import { requestNativeReview, shareApp } from '@/game/review';
import { markReviewAccepted } from '@/game/storage';
import { styles } from '@/game/menuSheetStyles';

/** Shared presentational rows and cards used across the menu's views. */
export type HighscoreKind = 'normal' | 'today' | 'record';

export function ToggleRow({
  label,
  subtitle,
  value,
  onPress,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <View style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}>
        <Text style={styles.toggleText}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

export function ActionRow({
  label,
  subtitle,
  onPress,
  destructive,
}: {
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDanger]}>
          {label}
        </Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.chevron, destructive && styles.rowLabelDanger]}>
        ›
      </Text>
    </Pressable>
  );
}

export function SupportCard() {
  return (
    <LinearGradient
      colors={['#7B5CFF', '#5B3DF5', '#4A2FE0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.supportCard}
    >
      <Text style={styles.supportTitle}>Support our ad-free app</Text>
      <Text style={styles.supportBody}>
        Your support helps small developers like us keep building free, ad-free
        games like this.
      </Text>
      <View style={styles.supportActions}>
        <Pressable
          onPress={() => {
            // Stop future soft prompts once they choose to review.
            void markReviewAccepted();
            void requestNativeReview();
          }}
          style={({ pressed }) => [
            styles.supportBtn,
            pressed && styles.supportBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Leave a 5-star review"
        >
          <SymbolView
            name={{
              ios: 'star.fill',
              android: 'star',
              web: 'star',
            }}
            size={16}
            tintColor={GameColors.white}
            weight="bold"
          />
          <Text style={styles.supportBtnText}>Review</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void shareApp().catch(() => {
              Alert.alert('Share failed', 'Could not open the share sheet.');
            });
          }}
          style={({ pressed }) => [
            styles.supportBtn,
            pressed && styles.supportBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Share MeterZone with friends"
        >
          <SymbolView
            name={{
              ios: 'square.and.arrow.up',
              android: 'share',
              web: 'share',
            }}
            size={16}
            tintColor={GameColors.white}
            weight="bold"
          />
          <Text style={styles.supportBtnText}>Share</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

export function HighscoreCard({
  badge,
  caption,
  mode,
  modeColor,
  accent,
  accentDeep,
  score,
  level,
  meta,
  emptyHint,
  hideShare,
  onShare,
}: {
  badge: string;
  /** Spells out what the number is, e.g. "All-time best". */
  caption: string;
  /** Which run this record came from, shown opposite the level pill. */
  mode: string;
  /** Ink for the mode pill — one hue per mode, so it reads at a glance. */
  modeColor: string;
  accent: string;
  accentDeep: string;
  score: number;
  level: number;
  meta?: string;
  emptyHint: string;
  hideShare?: boolean;
  onShare?: () => void;
}) {
  const empty = score <= 0;
  return (
    <View style={[styles.hsShell, { backgroundColor: accentDeep }]}>
      <View style={[styles.hsFace, { backgroundColor: accent }]}>
        <View style={styles.hsShine} />
        <View style={styles.hsTopRow}>
          <Text style={styles.hsCaption}>{caption}</Text>
          {!empty && onShare && !hideShare ? (
            <Pressable
              onPress={onShare}
              style={({ pressed }) => [
                styles.hsShareBtn,
                pressed && styles.closeBtnPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Share ${badge} highscore`}
            >
              <SymbolView
                name={{
                  ios: 'square.and.arrow.up',
                  android: 'share',
                  web: 'share',
                }}
                size={18}
                tintColor={GameColors.ink}
                weight="bold"
              />
            </Pressable>
          ) : null}
        </View>
        {empty ? (
          <View style={styles.hsEmptyBlock}>
            <Text style={styles.hsEmptyScore}>—</Text>
            <Text style={styles.hsEmptyHint}>{emptyHint}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.hsScore}>{formatScore(score)}</Text>
            <View style={styles.hsFooter}>
              <View style={styles.hsFooterLeft}>
                <View style={styles.hsLevelPill}>
                  <Text style={styles.hsLevelLabel}>LVL</Text>
                  <Text style={styles.hsLevelValue}>{level}</Text>
                </View>
                {meta ? <Text style={styles.hsMeta}>{meta}</Text> : null}
              </View>
              <View style={[styles.hsModePill, { borderColor: modeColor }]}>
                <Text style={[styles.hsModeText, { color: modeColor }]}>
                  {mode}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export function ModeRow({
  label,
  subtitle,
  selected,
  onPress,
}: {
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {selected ? <Text style={styles.selectedMark}>✓</Text> : null}
    </Pressable>
  );
}

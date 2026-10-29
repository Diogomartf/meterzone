import { LinearGradient } from 'expo-linear-gradient';
import {
  Alert,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useGT, useMessages } from 'gt-react-native';

import { FlatButton } from '@/game/FlatButton';
import { formatScore } from '@/game/format';
import {
  requestNativeReview,
  shareApp,
  SHARE_APP_TAGLINE,
} from '@/game/review';
import { markReviewAccepted } from '@/game/storage';
import { styles } from '@/game/menuSheetStyles';

const STAR_ICON = { ios: 'star.fill', android: 'star', web: 'star' } as const;
const SHARE_ICON = {
  ios: 'square.and.arrow.up',
  android: 'share',
  web: 'share',
} as const;

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
  const gt = useGT();
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
        <Text style={styles.toggleText}>{value ? gt('ON') : gt('OFF')}</Text>
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
  const gt = useGT();
  const m = useMessages();
  return (
    <LinearGradient
      colors={['#7B5CFF', '#5B3DF5', '#4A2FE0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.supportCard}
    >
      <Text style={styles.supportTitle}>{gt('Support our ad-free app')}</Text>
      <Text style={styles.supportBody}>
        {gt(
          'Your support helps small developers like us keep building free, ad-free games like this.',
        )}
      </Text>
      <View style={styles.supportActions}>
        <FlatButton
          tone="glass"
          style={styles.supportBtn}
          icon={STAR_ICON}
          label={gt('Review')}
          accessibilityLabel={gt('Leave a 5-star review')}
          onPress={() => {
            // Stop future soft prompts once they choose to review.
            void markReviewAccepted();
            void requestNativeReview();
          }}
        />
        <FlatButton
          tone="glass"
          style={styles.supportBtn}
          icon={SHARE_ICON}
          label={gt('Share')}
          accessibilityLabel={gt('Share MeterZone with friends')}
          onPress={() => {
            void shareApp(m(SHARE_APP_TAGLINE)).catch(() => {
              Alert.alert(
                gt('Share failed'),
                gt('Could not open the share sheet.'),
              );
            });
          }}
        />
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
  const gt = useGT();
  const empty = score <= 0;
  return (
    <View style={[styles.hsShell, { backgroundColor: accentDeep }]}>
      <View style={[styles.hsFace, { backgroundColor: accent }]}>
        <View style={styles.hsShine} />
        <View style={styles.hsTopRow}>
          <Text style={styles.hsCaption}>{caption}</Text>
          {!empty && onShare && !hideShare ? (
            <FlatButton
              onPress={onShare}
              icon={SHARE_ICON}
              size={36}
              hitSlop={8}
              accessibilityLabel={gt('Share {badge} highscore', { badge })}
            />
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
                  <Text style={styles.hsLevelLabel}>{gt('LVL')}</Text>
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

/** Chunky two-or-more way switch used at the top of menu pages. */
export function TabSwitch<T extends string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.rankTabs, style]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[styles.rankTab, active && styles.rankTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.rankTabText, active && styles.rankTabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

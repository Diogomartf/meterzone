import { Image, type ImageSource, type ImageStyle } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useGT, useMessages } from 'gt-react-native';

import { GameColors } from '@/constants/gameTheme';
import { FlatButton } from '@/game/FlatButton';
import { formatScore } from '@/game/format';
import {
  requestNativeReview,
  shareApp,
  SHARE_APP_TAGLINE,
} from '@/game/review';
import { markReviewAccepted } from '@/game/storage';
import { styles } from '@/game/menuSheetStyles';

const SUNBURST = require('../../assets/images/reward-sunburst.webp');

const STAR_ICON = { ios: 'star.fill', android: 'star', web: 'star' } as const;
const CHEVRON_ICON = {
  ios: 'chevron.right',
  android: 'chevron_right',
  web: 'chevron_right',
} as const;
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
  icon,
  onPress,
  destructive,
}: {
  label: string;
  subtitle?: string;
  /** Line icon before the label, for the compact links on the menu root. */
  icon?: SymbolViewProps['name'];
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        icon != null && styles.rowCompact,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
    >
      {icon != null ? (
        <SymbolView
          name={icon}
          size={26}
          tintColor={GameColors.ink}
          weight="semibold"
        />
      ) : null}
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

/**
 * A big tinted link on the menu root: art on the left, a bold label and a
 * short line, and a chevron. `tint` is the card's top-to-bottom wash.
 */
export function MenuTile({
  label,
  subtitle,
  art,
  artStyle,
  tint,
  onPress,
}: {
  label: string;
  subtitle: string;
  art: ImageSource;
  /** The art's own size, since each emblem has a different shape. */
  artStyle: StyleProp<ImageStyle>;
  tint: readonly [string, string];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.tilePressed}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${subtitle}`}
    >
      <LinearGradient
        colors={tint}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tile}
      >
        <View style={styles.tileArt}>
          <Image source={art} style={artStyle} contentFit="contain" />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.tileLabel}>{label}</Text>
          <Text style={styles.tileSub}>{subtitle}</Text>
        </View>
        <SymbolView
          name={CHEVRON_ICON}
          size={20}
          tintColor={GameColors.ink}
          weight="heavy"
        />
      </LinearGradient>
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
      <Text style={styles.supportTitle}>{gt('Enjoying MeterZone?')}</Text>
      <Text style={styles.supportBody}>
        {gt('Help our little ad-free game grow.')}
      </Text>
      <View style={styles.supportActions}>
        <FlatButton
          tone="glass"
          style={styles.supportBtn}
          icon={STAR_ICON}
          label={gt('Rate app')}
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

export function RecordCard({
  title,
  art,
  sunburst,
  accent,
  accentDeep,
  score,
  level,
  meta,
  emptyHint,
  hideShare,
  onShare,
  children,
}: {
  /** The mode, set big: "NORMAL", "DAILY CHALLENGE". */
  title: string;
  /** Mode emblem on the right: crown for Normal, medal for Daily. */
  art: ImageSource;
  /** Rays behind the emblem, for the gold card. */
  sunburst?: boolean;
  accent: string;
  accentDeep: string;
  score: number;
  level: number;
  /** Shown after the level inside its pill, e.g. the record's date. */
  meta?: string;
  emptyHint: string;
  hideShare?: boolean;
  onShare?: () => void;
  /** Extra rows under the record, like the daily card's "Today" strip. */
  children?: ReactNode;
}) {
  const gt = useGT();
  const empty = score <= 0;
  return (
    <View style={[styles.hsShell, { backgroundColor: accentDeep }]}>
      <View style={[styles.hsFace, { backgroundColor: accent }]}>
        {sunburst ? (
          <Image
            source={SUNBURST}
            style={styles.hsSunburst}
            contentFit="cover"
          />
        ) : null}
        <View style={styles.hsShine} />
        <View style={styles.hsMain}>
          <View style={styles.hsBody}>
            <Text
              style={styles.hsTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {title}
            </Text>
            <Text style={styles.hsTagText}>{gt('PERSONAL BEST')}</Text>
            {empty ? (
              <View style={styles.hsEmptyBlock}>
                <Text style={styles.hsEmptyScore}>—</Text>
                <Text style={styles.hsEmptyHint}>{emptyHint}</Text>
              </View>
            ) : (
              <>
                <Text
                  style={styles.hsScore}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {formatScore(score)}
                </Text>
                <LevelPill level={level} meta={meta} />
              </>
            )}
          </View>
          <View style={styles.hsSide}>
            {!empty && onShare && !hideShare ? (
              <FlatButton
                onPress={onShare}
                icon={SHARE_ICON}
                size={36}
                hitSlop={8}
                accessibilityLabel={gt('Share {title} record', { title })}
              />
            ) : (
              <View style={styles.hsSharePlaceholder} />
            )}
            <Image
              source={art}
              style={styles.hsArt}
              contentFit="contain"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

/**
 * "Level 17 · Oct 28, 2026" in a white pill, the level number set bold. The
 * date drops to its own line when the pill runs out of room, and never splits.
 */
function LevelPill({ level, meta }: { level: number; meta?: string }) {
  const gt = useGT();
  return (
    <View style={styles.hsLevelPill}>
      <Text style={styles.hsLevelLabel}>
        {gt('Level')} <Text style={styles.hsLevelValue}>{level}</Text>
      </Text>
      {meta ? (
        <Text style={styles.hsLevelLabel}>
          {`· ${meta}`.replace(/ /g, '\u00A0')}
        </Text>
      ) : null}
    </View>
  );
}

/** Today's daily score, tucked into the bottom of the daily record card. */
export function TodayStrip({
  played,
  score,
  level,
  emptyHint,
  hideShare,
  onShare,
}: {
  /** Whether a daily run finished today; a run can end on zero points. */
  played: boolean;
  score: number;
  level: number;
  emptyHint: string;
  hideShare?: boolean;
  onShare?: () => void;
}) {
  const gt = useGT();
  const empty = !played;
  return (
    <View style={styles.hsToday}>
      <Text style={styles.hsTodayLabel}>{gt('TODAY')}</Text>
      <View style={styles.hsTodayRule} />
      {empty ? (
        <Text style={styles.hsTodayHint}>{emptyHint}</Text>
      ) : (
        <>
          <Text
            style={styles.hsTodayScore}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatScore(score)}
          </Text>
          <LevelPill level={level} />
          {score > 0 && onShare && !hideShare ? (
            <FlatButton
              onPress={onShare}
              icon={SHARE_ICON}
              size={36}
              hitSlop={8}
              style={styles.hsTodayShare}
              accessibilityLabel={gt("Share today's daily score")}
            />
          ) : null}
        </>
      )}
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

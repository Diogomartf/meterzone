import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useGT, useMessages } from 'gt-react-native';

import {
  AVATAR_COLORS,
  AVATAR_PACKS,
  avatarPackAction,
  type AvatarPack,
} from '@/game/avatars';
import { formatScore } from '@/game/format';
import { MainButton } from '@/game/MainButton';
import { styles } from '@/game/menuSheetStyles';
import type { AvatarPackId, PlayerAvatar } from '@/game/types';
import { useSheetBottomPad } from '@/game/useSheetBottomPad';

const COIN = require('../../assets/images/coin.webp');

type AvatarPickerProps = {
  avatar: PlayerAvatar | null;
  unlockedPacks: readonly AvatarPackId[];
  coins: number;
  onSelect: (avatar: PlayerAvatar) => void;
  onUnlock: (id: AvatarPackId) => void;
};

/**
 * The "Avatar" tab of Avatar & Skins: pick a background color for free, and
 * an emoji from any pack you own. Extra packs cost coins.
 */
export function AvatarPicker({
  avatar,
  unlockedPacks,
  coins,
  onSelect,
  onUnlock,
}: AvatarPickerProps) {
  const gt = useGT();
  const current = avatar ?? { emoji: '🦊', color: AVATAR_COLORS[0] };
  const bottomPad = useSheetBottomPad();

  return (
    <ScrollView
      style={styles.menuScroll}
      contentContainerStyle={[styles.menuScrollContent, bottomPad]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      nestedScrollEnabled
    >
      <View style={styles.avatarPreviewCard}>
        <View style={styles.avatarPreviewRing}>
          <View
            style={[
              styles.avatarPreviewFace,
              { backgroundColor: current.color },
            ]}
          >
            <Text style={styles.avatarPreviewEmoji}>{current.emoji}</Text>
          </View>
        </View>
        <Text style={styles.avatarPreviewHint}>
          {gt('Your face on the leaderboard')}
        </Text>
      </View>

      <Text style={styles.avatarSection}>{gt('BACKGROUND')}</Text>
      <View style={[styles.card, styles.avatarSwatches]}>
        {AVATAR_COLORS.map((color) => {
          const selected = color === current.color;
          return (
            <Pressable
              key={color}
              onPress={() => onSelect({ ...current, color })}
              style={[styles.avatarSwatch, selected && styles.avatarSwatchOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={gt('Background color')}
            >
              <View
                style={[styles.avatarSwatchFill, { backgroundColor: color }]}
              />
            </Pressable>
          );
        })}
      </View>

      {AVATAR_PACKS.map((pack) => (
        <PackCard
          key={pack.id}
          pack={pack}
          current={current}
          unlockedPacks={unlockedPacks}
          coins={coins}
          onSelect={onSelect}
          onUnlock={onUnlock}
        />
      ))}
    </ScrollView>
  );
}

function PackCard({
  pack,
  current,
  unlockedPacks,
  coins,
  onSelect,
  onUnlock,
}: {
  pack: AvatarPack;
  current: PlayerAvatar;
  unlockedPacks: readonly AvatarPackId[];
  coins: number;
  onSelect: (avatar: PlayerAvatar) => void;
  onUnlock: (id: AvatarPackId) => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const action = avatarPackAction(pack, unlockedPacks, coins);
  const owned = action === 'owned';

  return (
    <View style={[styles.card, styles.avatarPack]}>
      <View style={styles.avatarPackHeader}>
        <Text style={styles.avatarPackName}>{m(pack.name)}</Text>
        {owned ? (
          <Text style={styles.avatarPackOwned}>
            {pack.cost === 0 ? gt('FREE') : gt('OWNED')}
          </Text>
        ) : (
          <View
            style={[
              styles.avatarUnlock,
              action === 'locked' && styles.avatarUnlockLocked,
            ]}
            accessibilityLabel={gt('{cost} coins', {
              cost: formatScore(pack.cost),
            })}
          >
            <Image
              source={COIN}
              style={styles.avatarUnlockCoin}
              contentFit="contain"
            />
            <Text style={styles.avatarUnlockText}>
              {formatScore(pack.cost)}
            </Text>
          </View>
        )}
      </View>
      <View>
        <View style={styles.avatarGrid}>
          {pack.emojis.map((emoji) => {
            const selected = emoji === current.emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => onSelect({ ...current, emoji })}
                disabled={!owned}
                style={[
                  styles.avatarCell,
                  selected && styles.avatarCellOn,
                  !owned && styles.avatarCellLocked,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !owned }}
                accessibilityLabel={emoji}
              >
                <Text style={styles.avatarCellEmoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
        {/* Locked packs: the way in sits right over the faces it opens. */}
        {!owned ? (
          <View style={styles.avatarLockOverlay} pointerEvents="box-none">
            {action === 'locked' ? (
              <View style={styles.avatarNeed}>
                <Text style={styles.avatarNeedText}>
                  {gt('🔒 {count} more coins', {
                    count: formatScore(pack.cost - coins),
                  })}
                </Text>
              </View>
            ) : (
              <MainButton
                tone="gold"
                size="small"
                label={gt('Unlock')}
                onPress={() => onUnlock(pack.id)}
              />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

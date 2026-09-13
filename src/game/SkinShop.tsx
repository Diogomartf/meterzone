import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { msg, useGT, useMessages } from 'gt-react-native';

import { formatScore } from '@/game/format';
import { styles } from '@/game/menuSheetStyles';
import {
  SKINS,
  SKIN_IDS,
  skinAction,
  unlockedSkinCount,
  type SkinAction,
  type SkinDef,
} from '@/game/skins';
import type { SkinId } from '@/game/types';

const SKIN_NAME: Record<SkinId, string> = {
  toxic: msg('Toxic'),
  lava: msg('Lava'),
  ice: msg('Ice'),
  gold: msg('Gold'),
};

const SKIN_BLURB: Record<SkinId, string> = {
  toxic: msg('The classic slime'),
  lava: msg('Molten and loud'),
  ice: msg('Cool and precise'),
  gold: msg('Champion shine'),
};

const ACTION_LABEL: Record<SkinAction, string> = {
  equipped: msg('EQUIPPED'),
  equip: msg('EQUIP'),
  unlock: msg('UNLOCK'),
  locked: msg('LOCKED'),
};

type SkinShopProps = {
  coins: number;
  unlockedSkins: readonly SkinId[];
  equippedSkin: SkinId;
  onUnlock: (id: SkinId) => void;
  onEquip: (id: SkinId) => void;
};

function actionStyle(action: SkinAction) {
  if (action === 'equipped') return styles.skinActionEquipped;
  if (action === 'equip') return styles.skinActionEquip;
  if (action === 'unlock') return styles.skinActionUnlock;
  return styles.skinActionLocked;
}

function SkinRow({
  skin,
  action,
  coins,
  onUnlock,
  onEquip,
}: {
  skin: SkinDef;
  action: SkinAction;
  coins: number;
  onUnlock: (id: SkinId) => void;
  onEquip: (id: SkinId) => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const lockedShort = Math.max(0, skin.cost - coins);
  const name = m(SKIN_NAME[skin.id]);
  const pressable = action === 'equip' || action === 'unlock';

  const onPress = () => {
    if (action === 'equip') onEquip(skin.id);
    if (action === 'unlock') onUnlock(skin.id);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!pressable}
      style={({ pressed }) => [
        styles.skinRow,
        pressed && pressable && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{
        disabled: !pressable,
        selected: action === 'equipped',
      }}
      accessibilityLabel={
        action === 'equipped'
          ? gt('{name} skin. Equipped.', { name })
          : action === 'equip'
            ? gt('Equip {name} skin', { name })
            : action === 'unlock'
              ? gt('Unlock {name} for {cost} coins', {
                  name,
                  cost: skin.cost,
                })
              : gt('{name} skin locked. Need {count} more coins.', {
                  name,
                  count: lockedShort,
                })
      }
    >
      <View
        style={[styles.skinSwatchShell, { backgroundColor: skin.shellDark }]}
      >
        <LinearGradient
          colors={[...skin.liquid]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.skinSwatch, { borderColor: skin.shell }]}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{name}</Text>
        <Text style={styles.rowSub}>
          {action === 'locked'
            ? gt('Need {count} more', { count: lockedShort })
            : action === 'unlock'
              ? gt('{cost} coins', { cost: skin.cost })
              : m(SKIN_BLURB[skin.id])}
        </Text>
      </View>
      <View style={[styles.skinAction, actionStyle(action)]}>
        <Text
          style={[
            styles.skinActionText,
            action === 'locked' && styles.skinActionTextLocked,
          ]}
        >
          {m(ACTION_LABEL[action])}
        </Text>
      </View>
    </Pressable>
  );
}

/** Menu shop — spend run coins on meter looks that are already in save data. */
export function SkinShop({
  coins,
  unlockedSkins,
  equippedSkin,
  onUnlock,
  onEquip,
}: SkinShopProps) {
  const gt = useGT();
  const owned = unlockedSkinCount(unlockedSkins);

  return (
    <ScrollView
      style={styles.menuScroll}
      contentContainerStyle={styles.menuScrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.skinBank}>
        <Text style={styles.skinBankLabel}>{gt('YOUR COINS')}</Text>
        <Text style={styles.skinBankValue}>{formatScore(coins)}</Text>
        <Text style={styles.skinBankHint}>
          {gt(
            'Perfect, Great, and Nice hits pay coins. Spend them on a new look for the meter.',
          )}
        </Text>
        <Text style={styles.skinBankOwned}>
          {gt('{owned} of {total} unlocked', {
            owned,
            total: SKIN_IDS.length,
          })}
        </Text>
      </View>

      <View style={styles.card}>
        {SKIN_IDS.map((id, i) => {
          const skin = SKINS[id];
          return (
            <View key={id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <SkinRow
                skin={skin}
                action={skinAction(skin, equippedSkin, unlockedSkins, coins)}
                coins={coins}
                onUnlock={onUnlock}
                onEquip={onEquip}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

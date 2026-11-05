import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { msg, useGT, useMessages } from 'gt-react-native';

import { GameColors, Gradients } from '@/constants/gameTheme';
import { formatScore } from '@/game/format';
import { styles } from '@/game/menuSheetStyles';
import {
  SKINS,
  SKIN_IDS,
  skinAction,
  type SkinAction,
  type SkinDef,
} from '@/game/skins';
import type { SkinId } from '@/game/types';
import { useSheetBottomPad } from '@/game/useSheetBottomPad';

const COIN = require('../../assets/images/coin.webp');

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

/** Capsule art per skin. Toxic has none yet, so it's drawn from its colours. */
const SKIN_ART: Partial<Record<SkinId, number>> = {
  lava: require('../../assets/images/skin-lava.webp'),
  ice: require('../../assets/images/skin-ice.webp'),
  gold: require('../../assets/images/skin-gold.webp'),
};

/** Each card's wash, a pale take on the skin's own colour. */
const SKIN_TINT: Record<SkinId, string> = {
  toxic: '#E3F8EC',
  lava: '#FFE8E0',
  ice: '#E2F0FC',
  gold: '#FFF2DA',
};

const CHECK_ICON = {
  ios: 'checkmark',
  android: 'check',
  web: 'check',
} as const;
const LOCK_ICON = { ios: 'lock.fill', android: 'lock', web: 'lock' } as const;

type SkinShopProps = {
  coins: number;
  unlockedSkins: readonly SkinId[];
  equippedSkin: SkinId;
  onUnlock: (id: SkinId) => void;
  onEquip: (id: SkinId) => void;
};

function PriceTag({ cost }: { cost: number }) {
  const gt = useGT();
  return (
    <View
      style={styles.skinPrice}
      accessibilityLabel={gt('{cost} coins', { cost })}
    >
      <Image source={COIN} style={styles.skinPriceCoin} contentFit="contain" />
      <Text style={styles.skinPriceText}>{formatScore(cost)}</Text>
    </View>
  );
}

/** Stand-in capsule for a skin without art: its liquid in an ink-rimmed pill. */
function DrawnCapsule({ skin }: { skin: SkinDef }) {
  return (
    <View style={styles.skinCapsule}>
      <LinearGradient
        // Skip the foam colour so it reads as liquid top to bottom.
        colors={[
          skin.liquid[1],
          skin.liquid[2],
          skin.liquid[3],
          skin.liquid[4],
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.skinCapsuleLiquid}
      />
      <View style={styles.skinCapsuleShine} />
      <View style={styles.skinCapsuleRing} />
    </View>
  );
}

function SkinCard({
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
  const art = SKIN_ART[skin.id];

  const onPress = () => {
    if (action === 'equip') onEquip(skin.id);
    if (action === 'unlock') onUnlock(skin.id);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!pressable}
      style={({ pressed }) => [
        styles.skinCard,
        { backgroundColor: SKIN_TINT[skin.id] },
        action === 'equipped' && styles.skinCardEquipped,
        pressed && pressable && styles.tilePressed,
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
              : gt(
                  '{name} skin locked. {cost} coins. Need {count} more coins.',
                  {
                    name,
                    cost: skin.cost,
                    count: lockedShort,
                  },
                )
      }
    >
      {art != null ? (
        <Image source={art} style={styles.skinArt} contentFit="contain" />
      ) : (
        <DrawnCapsule skin={skin} />
      )}
      <Text style={styles.skinName} numberOfLines={1}>
        {name}
      </Text>

      {action === 'equipped' || action === 'equip' ? (
        <>
          <Text style={styles.skinBlurb} numberOfLines={1}>
            {m(SKIN_BLURB[skin.id])}
          </Text>
          {action === 'equipped' ? (
            <View style={[styles.skinBadge, styles.skinBadgeEquipped]}>
              <SymbolView
                name={CHECK_ICON}
                size={15}
                tintColor={GameColors.white}
                weight="heavy"
              />
              <Text
                style={[styles.skinBadgeText, styles.skinBadgeTextEquipped]}
              >
                {gt('Equipped')}
              </Text>
            </View>
          ) : (
            <View style={[styles.skinBadge, styles.skinBadgeEquip]}>
              <Text style={styles.skinBadgeText}>{gt('Equip')}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <PriceTag cost={skin.cost} />
          {action === 'unlock' ? (
            <View style={[styles.skinBadge, styles.skinBadgeUnlock]}>
              <Text style={styles.skinBadgeText}>{gt('Unlock')}</Text>
            </View>
          ) : (
            <View style={styles.skinShort}>
              <SymbolView
                name={LOCK_ICON}
                size={13}
                tintColor="#6B7A99"
                weight="bold"
              />
              <Text style={styles.skinShortText} numberOfLines={1}>
                {gt('{count} more coins', { count: formatScore(lockedShort) })}
              </Text>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

export function CoinBank({ coins }: { coins: number }) {
  const gt = useGT();
  return (
    <LinearGradient colors={Gradients.coinGold} style={styles.skinBank}>
      <Text style={styles.skinBankLabel}>{gt('YOUR COINS')}</Text>
      <View style={styles.skinBankValueRow}>
        <Image source={COIN} style={styles.skinBankCoin} contentFit="contain" />
        <Text
          style={styles.skinBankValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatScore(coins)}
        </Text>
      </View>
    </LinearGradient>
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
  const bottomPad = useSheetBottomPad();

  return (
    <ScrollView
      style={styles.menuScroll}
      contentContainerStyle={[styles.menuScrollContent, bottomPad]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.skinGrid}>
        {SKIN_IDS.map((id) => {
          const skin = SKINS[id];
          return (
            <SkinCard
              key={id}
              skin={skin}
              action={skinAction(skin, equippedSkin, unlockedSkins, coins)}
              coins={coins}
              onUnlock={onUnlock}
              onEquip={onEquip}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { requestNativeReview } from '@/game/review';

type ReviewPromptModalProps = {
  visible: boolean;
  /** User chose positive path — persist + native review */
  onAccept: () => void;
  /** User declined or dismissed — persist only */
  onDecline: () => void;
};

/**
 * Soft first-party prompt. Never calls StoreReview until the user taps
 * the positive action (Rate 5 stars).
 */
export function ReviewPromptModal({
  visible,
  onAccept,
  onDecline,
}: ReviewPromptModalProps) {
  const accept = () => {
    onAccept();
    void requestNativeReview();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onDecline}
          accessibilityLabel="Dismiss"
        />
        <View style={styles.sheet}>
          <LinearGradient
            colors={['#7B5CFF', '#5B3DF5', '#4A2FE0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.starsRow} accessibilityElementsHidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <SymbolView
                  key={i}
                  name={{
                    ios: 'star.fill',
                    android: 'star',
                    web: 'star',
                  }}
                  size={22}
                  tintColor={GameColors.lemon}
                  weight="bold"
                />
              ))}
            </View>
            <Text style={styles.title}>Enjoying MeterZone?</Text>
            <Text style={styles.body}>
              A quick 5★ review helps more players find us — and keeps the game
              free and ad-free.
            </Text>

            <Pressable
              onPress={accept}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Rate 5 stars"
            >
              <SymbolView
                name={{
                  ios: 'star.fill',
                  android: 'star',
                  web: 'star',
                }}
                size={18}
                tintColor={GameColors.ink}
                weight="bold"
              />
              <Text style={styles.primaryBtnText}>Rate 5 stars</Text>
            </Pressable>

            <Pressable
              onPress={onDecline}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={styles.secondaryBtnText}>Not now</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(26,28,44,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    zIndex: 1,
  },
  card: {
    borderRadius: 24,
    borderWidth: 3,
    borderColor: GameColors.ink,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontFamily: GameFonts.display,
    fontSize: 26,
    lineHeight: 30,
    color: GameColors.white,
    textAlign: 'center',
  },
  body: {
    fontFamily: GameFonts.soft,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginBottom: 6,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: GameColors.lemon,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
  },
  primaryBtnText: {
    fontFamily: GameFonts.body,
    fontSize: 18,
    lineHeight: 22,
    color: GameColors.ink,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryBtnText: {
    fontFamily: GameFonts.body,
    fontSize: 16,
    lineHeight: 20,
    color: GameColors.white,
  },
  btnPressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
});

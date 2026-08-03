import { mock } from 'bun:test';

/**
 * Bun's transpiler can't parse react-native's Flow-typed entrypoint, and the
 * native modules have no meaning outside a device. These stubs let the pure
 * game logic (scoring, levels, review ladder, persistence) be tested directly.
 *
 * Registered via `preload` in bunfig.toml.
 */

mock.module('react-native', () => ({
  Platform: { OS: 'ios', select: (spec: Record<string, unknown>) => spec.ios },
  Linking: {
    canOpenURL: async () => true,
    openURL: async () => undefined,
  },
  Share: { share: async () => ({ action: 'sharedAction' }) },
  Alert: { alert: () => undefined },
}));

mock.module('expo-store-review', () => ({
  isAvailableAsync: async () => false,
  hasAction: async () => false,
  requestReview: async () => undefined,
}));

/** In-memory AsyncStorage — reset between tests via `resetAsyncStorage()`. */
const store = new Map<string, string>();

export function resetAsyncStorage() {
  store.clear();
}

export function seedAsyncStorage(key: string, value: string) {
  store.set(key, value);
}

export function readAsyncStorage(key: string) {
  return store.get(key);
}

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
  },
}));

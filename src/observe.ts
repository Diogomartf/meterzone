import type { ComponentType } from 'react';

/**
 * expo-observe requires native modules that only exist after a rebuild.
 * A stale dev client throws on import, which expo-router treats as "no default
 * export" and leaves Metro's websocket with no JS listeners.
 */
type ObserveModule = typeof import('expo-observe');

function loadObserve(): ObserveModule | null {
  try {
    // Static import throws before we can catch — require is the only way to
    // keep the app booting on a dev client that hasn't been rebuilt yet.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-observe') as ObserveModule;
  } catch {
    return null;
  }
}

const observe = loadObserve();
const noopObserve = { markInteractive() {} };

export function configureObserve(): void {
  observe?.Observe.configure({ integrations: { 'expo-router': true } });
}

export function markLaunchInteractive(): void {
  observe?.Observe.markInteractive();
}

export function wrapWithObserve<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return observe ? observe.ObserveRoot.wrap(Component) : Component;
}

export function useObserveSafe(): { markInteractive: () => void } {
  return observe ? observe.useObserve() : noopObserve;
}

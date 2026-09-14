import { describe, expect, test } from 'bun:test';

/**
 * The tap guard lives on the UI thread, so it cannot be exercised through the
 * component. This models the two threads instead: `isFilling` is the lock, the
 * fill's completion callback and a tap both run against it, and `finishRound`
 * lands later on the JS thread.
 *
 * Regression: the completion callback used to leave `isFilling` set and rely on
 * `finishRound` clearing it once the JS thread got around to it. A tap in that
 * gap scored the same round twice.
 */
function makeMeter() {
  let isFilling = 0;
  const scored: string[] = [];
  const jsQueue: (() => void)[] = [];

  return {
    scored,
    startFill() {
      isFilling = 1;
    },
    /** UI thread: the fill reached the end. */
    completeFill() {
      if (!isFilling) return;
      isFilling = 0;
      jsQueue.push(() => scored.push('fill-complete'));
    },
    /** UI thread: a finger landed. */
    tap() {
      if (isFilling !== 1) return;
      isFilling = 0;
      jsQueue.push(() => scored.push('tap'));
    },
    /** JS thread catches up. */
    drainJs() {
      while (jsQueue.length) jsQueue.shift()!();
    },
  };
}

describe('meter tap lock', () => {
  test('a tap after the fill lands cannot score the round again', () => {
    const meter = makeMeter();
    meter.startFill();
    meter.completeFill();
    // The JS thread has not run yet — this is the window the bug lived in.
    meter.tap();
    meter.drainJs();

    expect(meter.scored).toEqual(['fill-complete']);
  });

  test('a tap during the fill scores once and blocks the completion', () => {
    const meter = makeMeter();
    meter.startFill();
    meter.tap();
    meter.completeFill();
    meter.drainJs();

    expect(meter.scored).toEqual(['tap']);
  });

  test('repeated taps in one fill score once', () => {
    const meter = makeMeter();
    meter.startFill();
    meter.tap();
    meter.tap();
    meter.tap();
    meter.drainJs();

    expect(meter.scored).toEqual(['tap']);
  });
});

const SAMPLE_WINDOW_MS = 1500;

/**
 * Sample completed render frames with an unmodified, monotonic wall clock in ms.
 * Call reset() at pause/visibility/quality boundaries; a long frame is otherwise
 * real work or a stall and must not be clamped away. The first point anchors a
 * window, so frameCount counts measured intervals, not timestamp submissions.
 */
export function createFrameSampler() {
  let previous = null;
  let started = null;
  const intervals = [];

  function reset() {
    previous = null;
    started = null;
    intervals.length = 0;
  }

  function sample(now) {
    if (!Number.isFinite(now) || now < 0) {
      reset();
      return null;
    }
    if (previous !== null && now < previous) reset();
    if (previous === null) {
      previous = started = now;
      return null;
    }
    // A repeated callback timestamp is not another measurable frame interval.
    if (now === previous) return null;

    intervals.push(now - previous);
    previous = now;
    const windowMs = now - started;
    if (windowMs < SAMPLE_WINDOW_MS) return null;

    const frameCount = intervals.length;
    intervals.sort((a, b) => a - b);
    const result = {
      fps: frameCount * 1000 / windowMs,
      averageFrameMs: windowMs / frameCount,
      // Nearest-rank p95: retain observed stalls rather than interpolating them.
      p95FrameMs: intervals[Math.ceil(frameCount * .95) - 1],
      frameCount,
      windowMs,
    };
    // Keep the ending timestamp as the next window's anchor. Windows never
    // overlap or split an observed interval at an artificial 1500 ms boundary.
    started = now;
    intervals.length = 0;
    return result;
  }

  return { sample, reset };
}

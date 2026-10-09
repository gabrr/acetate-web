const durationFormatter = typeof Intl.DurationFormat === 'function'
  ? new Intl.DurationFormat('en', { style: 'long' })
  : null;
const unitFormatters = Object.fromEntries(['hour', 'minute', 'second'].map(unit => [
  unit, new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 }),
]));
const durationList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function formatDuration(milliseconds) {
  const seconds = Math.max(0, milliseconds) / 1000;
  if (seconds < 60) return unitFormatters.second.format(Math.floor(seconds * 10) / 10);

  const wholeSeconds = Math.floor(seconds);
  const duration = {
    hours: Math.floor(wholeSeconds / 3600),
    minutes: Math.floor(wholeSeconds / 60) % 60,
    seconds: wholeSeconds % 60,
  };
  if (durationFormatter) return durationFormatter.format(duration);

  return durationList.format(Object.entries(duration)
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => unitFormatters[unit.slice(0, -1)].format(value)));
}

export function createRunTimer(element, onTick = () => {}) {
  let startedAt = null;
  let interval = null;

  function update() {
    element.textContent = `Elapsed ${formatDuration(performance.now() - startedAt)}`;
    onTick();
  }

  return {
    start(elapsedMs = 0) {
      if (interval !== null) clearInterval(interval);
      startedAt = performance.now() - elapsedMs;
      element.hidden = false;
      update();
      interval = setInterval(update, 250);
    },
    stop() {
      if (startedAt === null) return;
      clearInterval(interval);
      interval = null;
      update();
      startedAt = null;
    },
  };
}

export function trackStep(previous, step, now = performance.now()) {
  return {
    ...previous,
    ...step,
    startedAt: step.state === 'running' ? now : (previous?.startedAt ?? now),
    endedAt: step.state === 'completed' ? now : null,
  };
}

export function formatStepTime(step, now = performance.now()) {
  return formatDuration((step.endedAt ?? now) - step.startedAt);
}

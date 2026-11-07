// Consistent educational *temperature indicator* in °C, not incandescent
// radiation. Hue depends on the measured/displayed temperature, while the
// separate heating progress controls how brightly the pedestal is lit.
const STOPS = [
  [-60, 0x3e8bd8],
  [-20, 0x56b9ee],
  [0, 0x83d9f4],
  [25, 0xe8f0ee],
  [40, 0xffeac2],
  [65, 0xffc36b],
  [85, 0xff963d],
  [100, 0xff5829],
  [140, 0xe73a24],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function temperatureIndicatorColor(celsius) {
  if (!Number.isFinite(celsius)) return '#e8f0ee';
  const value = clamp(celsius, STOPS[0][0], STOPS.at(-1)[0]);
  for (let i = 1; i < STOPS.length; i++) {
    const [endTemperature, endRgb] = STOPS[i];
    if (value > endTemperature) continue;
    const [startTemperature, startRgb] = STOPS[i - 1];
    const fraction = (value - startTemperature) / (endTemperature - startTemperature);
    const channel = shift => Math.round(((startRgb >> shift) & 255) * (1 - fraction) + ((endRgb >> shift) & 255) * fraction);
    return `#${[16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('')}`;
  }
  return '#e73a24';
}

// The Canvas fallback has two pre-tinted copies of the pedestal image. The
// neutral zone preserves its original white markings; cold and warm zones
// crossfade independently, with no relationship to a molecule's boiling point.
export function temperatureIndicatorWeights(celsius) {
  if (!Number.isFinite(celsius)) return { cold: 0, warm: 0 };
  return {
    cold: clamp((25 - celsius) / 45, 0, 1),
    warm: clamp((celsius - 25) / 75, 0, 1),
  };
}

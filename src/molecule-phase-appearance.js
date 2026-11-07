// The render swatch is an intentionally approximate display color. Molecular
// structure (CPK colors) and the visible color of a bulk liquid are distinct.
export const NEUTRAL_LIQUID_COLOR = '#eaf3f7';
export const NEUTRAL_GAS_COLOR = '#f6f9fc';

export function phaseAppearanceFor(record, phase) {
  if (phase !== 'liquid' && phase !== 'gas') throw new RangeError(`Unknown phase: ${phase}`);
  const appearance = record?.phaseAppearance?.[phase];
  const kind = appearance?.kind === 'colored' || appearance?.kind === 'colorless'
    ? appearance.kind : 'none';
  return {
    kind,
    labelJa: kind === 'colored' ? '有色' : kind === 'colorless' ? '無色' : '特徴なし',
    renderColor: kind === 'colored' ? appearance.renderColor
      : phase === 'liquid' ? NEUTRAL_LIQUID_COLOR : NEUTRAL_GAS_COLOR,
  };
}

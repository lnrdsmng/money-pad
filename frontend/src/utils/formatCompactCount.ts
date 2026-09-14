export function formatCompactCount(value: number): string {
  if (value < 1_000) return String(value);

  const units = [
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ];
  const unit = units.find(({ threshold }) => value >= threshold)!;
  const compactValue = value / unit.threshold;
  const precision = compactValue < 10 && compactValue % 1 !== 0 ? 1 : 0;

  return `${compactValue.toFixed(precision).replace(/\.0$/, '')}${unit.suffix}`;
}

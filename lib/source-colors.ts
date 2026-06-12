const SOURCE_COLORS: Record<string, string> = {
  bcp: '#FF7800',
  yape: '#8D149D',
  plin: '#1CBBE2',
  ibk: '#04BE4F',
  interbank: '#04BE4F',
  bbva: '#001491',
  scotia: '#FA0000',
  scotiabank: '#FA0000',
};

const RESERVED_COLORS = new Set(Object.values(SOURCE_COLORS));

const OTHER_COLORS = [
  '#6366F1',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#64748B',
  '#A855F7',
  '#0EA5E9',
  '#84CC16',
  '#E11D48',
  '#0891B2',
];

function normalizeSourceKey(source: string): string {
  return source.trim().toLowerCase().replace(/\s+/g, '');
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSourceBackgroundColor(source: string): string {
  const key = normalizeSourceKey(source);
  const known = SOURCE_COLORS[key];
  if (known) return known;

  const index = hashString(key) % OTHER_COLORS.length;
  return OTHER_COLORS[index];
}

export function getSourceForegroundColor(_source: string): string {
  return '#FFFFFF';
}

export function isReservedSourceColor(color: string): boolean {
  return RESERVED_COLORS.has(color.toUpperCase());
}

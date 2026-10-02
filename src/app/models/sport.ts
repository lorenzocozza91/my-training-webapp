export interface SportMeta {
  label: string;
  color: string;
}

export const SPORT_META: Record<string, SportMeta> = {
  running: { label: 'Running', color: '#FC4C02' },
  cycling: { label: 'Cycling', color: '#1F8B4C' },
  training: { label: 'Training', color: '#7C3AED' },
  cardio: { label: 'Cardio', color: '#7C3AED' }
};

export function getSportMeta(sport: string): SportMeta {
  return SPORT_META[sport] ?? { label: sport, color: '#64748B' };
}

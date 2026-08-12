export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || meters <= 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatSpeed(metersPerSecond: number | null | undefined): string {
  if (metersPerSecond == null || metersPerSecond <= 0) return '—';
  return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
}

export function formatPace(metersPerSecond: number | null | undefined): string {
  if (metersPerSecond == null || metersPerSecond <= 0) return '—';
  const secondsPerKm = 1000 / metersPerSecond;
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters == null) return '—';
  return `${Math.round(meters)} m`;
}

export function formatCalories(calories: number | null | undefined): string {
  if (calories == null) return '—';
  return `${Math.round(calories)} kcal`;
}

export function formatIntensity(ifactor: number | null | undefined): string {
  if (ifactor == null) return '—';
  return `${Math.round(ifactor * 100)} %`;
}

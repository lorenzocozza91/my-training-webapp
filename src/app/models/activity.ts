export interface Activity {
  id: number;
  name: string;
  sport: string;
  subSport: string;
  startedAt: string;
  durationSeconds: number;
  elapsedTimeSeconds: number;
  distanceMeters: number;
  calories: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageSpeedMetersPerSecond: number | null;
  maxSpeedMetersPerSecond: number | null;
  ascentMeters: number | null;
  descentMeters: number | null;
  averageCadenceRpm: number | null;
  maxCadenceRpm: number | null;
  averagePowerWatts: number | null;
  maxPowerWatts: number | null;
  intensityFactor: number | null;
  cycling: boolean;
  running: boolean;
}

export interface ActivitiesResponse {
  activities: Activity[];
}

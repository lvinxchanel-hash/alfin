export type FocusTarget = 'overview' | 'mic' | 'mixer' | 'speaker';

export type PowerTap = 3 | 6 | 10;

export type SensorStatus = 'normal' | 'warning' | 'danger';

export interface AudioControlsState {
  gain: number;       // 0 - 100 %
  bass: number;       // -12 to +12 dB
  treble: number;     // -12 to +12 dB
  volume: number;     // 0 - 100 %
  powerTap: PowerTap; // 3W, 6W, 10W
  isPaging: boolean;
  isBgmPlaying: boolean;
  isOverload: boolean;
  isMuted: boolean;
}

export interface TelemetryHistoryPoint {
  t: number;
  db: number;
  temp: number;
  amp: number;
}

export interface TelemetryState {
  dbSpl: number;           // 30 - 115 dB SPL
  temperature: number;     // °C (ambient ~28°C, alarm > 75°C)
  currentAmpere: number;   // Ampere on 100V line (I = P / V)
  lineVoltage: number;     // 100V nominal (drops slightly under overload)
  effectivePowerW: number; // Instantaneous acoustic/electrical power (W)
  micSignalLevel: number;  // 0 - 1 normalized
  speakerSignalLevel: number; // 0 - 1 normalized
  bgmDucked: boolean;
  priorityRelayActive: boolean;
  thermalAlarm: boolean;
  overloadAlarm: boolean;
  dbStatus: SensorStatus;
  tempStatus: SensorStatus;
  ampStatus: SensorStatus;
  history: TelemetryHistoryPoint[];
}

export interface ComponentLayerInfo {
  id: string;
  index: number;
  component: Exclude<FocusTarget, 'overview'>;
  name: string;
  shortLabel: string;
  description: string;
  specs: string;
  accentColor: string;
}

export interface CameraPreset {
  target: FocusTarget;
  label: string;
  subtitle: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}

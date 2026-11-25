import { AlertTriangle, Flame, Gauge, Volume2, Zap } from 'lucide-react';
import { AudioControlsState, SensorStatus, TelemetryState } from '../../types/paSystem';

interface TelemetryHudProps {
  telemetry: TelemetryState;
  controls: AudioControlsState;
  onToggleOverload: () => void;
}

const STATUS_META: Record<
  SensorStatus,
  { label: string; dotClass: string; textClass: string; stroke: string; fill: string }
> = {
  normal: {
    label: 'Hijau · Normal',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-300',
    stroke: '#34d399',
    fill: 'rgba(52, 211, 153, 0.14)',
  },
  warning: {
    label: 'Kuning · Waspada',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-300',
    stroke: '#fbbf24',
    fill: 'rgba(251, 191, 36, 0.14)',
  },
  danger: {
    label: 'Merah · Bahaya',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-300',
    stroke: '#f43f5e',
    fill: 'rgba(244, 63, 94, 0.18)',
  },
};

interface SparklineProps {
  values: number[];
  min: number;
  max: number;
  stroke: string;
  fill: string;
  thresholdY?: number;
}

function TelemetrySparkline({
  values,
  min,
  max,
  stroke,
  fill,
  thresholdY,
}: SparklineProps) {
  const width = 240;
  const height = 44;
  const safeValues = values.length >= 2 ? values : [min, min];
  const range = Math.max(0.001, max - min);

  const points = safeValues.map((v, i) => {
    const x = (i / (safeValues.length - 1)) * width;
    const norm = Math.min(1, Math.max(0, (v - min) / range));
    const y = height - norm * (height - 6) - 3;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const thresholdPixelY =
    thresholdY !== undefined
      ? height - Math.min(1, Math.max(0, (thresholdY - min) / range)) * (height - 6) - 3
      : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-full overflow-visible rounded bg-slate-900/80 border border-slate-800/80"
      aria-hidden="true"
    >
      {thresholdPixelY !== null && (
        <line
          x1={0}
          x2={width}
          y1={thresholdPixelY}
          y2={thresholdPixelY}
          stroke="#ef4444"
          strokeDasharray="4 3"
          strokeWidth={1}
          opacity={0.75}
        />
      )}
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

export function TelemetryHud({
  telemetry,
  controls,
  onToggleOverload,
}: TelemetryHudProps) {
  const dbMeta = STATUS_META[telemetry.dbStatus];
  const tempMeta = STATUS_META[telemetry.tempStatus];
  const ampMeta = STATUS_META[telemetry.ampStatus];

  const dbValues = telemetry.history.map((h) => h.db);
  const tempValues = telemetry.history.map((h) => h.temp);
  const ampValues = telemetry.history.map((h) => h.amp);

  return (
    <aside
      aria-label="Telemetri Sensor Real-Time"
      className="pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/92 p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-800/90 pb-2.5">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Telemetri Sensor Real-Time
          </h2>
          <p className="text-[11px] text-slate-400">
            Ruang Aula · Jalur 100V Line
          </p>
        </div>
        <Gauge className="h-4 w-4 text-cyan-400" />
      </div>

      {/* Alarm Banner when Thermal >75°C or Overload Active */}
      {(telemetry.thermalAlarm || telemetry.overloadAlarm) && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/50 bg-rose-950/70 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="leading-snug">
            <span className="font-semibold text-rose-100">
              {telemetry.overloadAlarm ? 'Proteksi Beban Berlebih Aktif' : 'Alarm Suhu Tinggi (>75°C)'}
            </span>
            <p className="mt-0.5 text-[11px] text-rose-300">
              {telemetry.overloadAlarm
                ? 'Arus jalur 100V melebihi batas aman. Matikan simulasi overload untuk memulihkan sistem.'
                : 'Daya speaker tinggi terus-menerus memanaskan kumparan dan trafo. Turunkan Power Tap atau Volume.'}
            </p>
          </div>
        </div>
      )}

      {/* 1. Sensor Suara (dB SPL) */}
      <section className="flex flex-col gap-1.5 border-b border-slate-800/75 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
            <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>1. Sensor Suara (dB SPL)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className={`inline-block h-2 w-2 rounded-full ${dbMeta.dotClass}`} />
            <span className={dbMeta.textClass}>{dbMeta.label}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="font-mono-tabular text-2xl font-bold text-slate-50">
            {telemetry.dbSpl.toFixed(1)}
            <span className="ml-1 text-xs font-medium text-slate-400">dB SPL</span>
          </span>
          <span className="font-mono-tabular text-[11px] text-slate-400">
            Rentang 30 – 115 dB
          </span>
        </div>

        <TelemetrySparkline
          values={dbValues}
          min={30}
          max={115}
          stroke={dbMeta.stroke}
          fill={dbMeta.fill}
          thresholdY={100}
        />
      </section>

      {/* 2. Sensor Suhu (°C) */}
      <section className="flex flex-col gap-1.5 border-b border-slate-800/75 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>2. Sensor Suhu (°C)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className={`inline-block h-2 w-2 rounded-full ${tempMeta.dotClass}`} />
            <span className={tempMeta.textClass}>{tempMeta.label}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="font-mono-tabular text-2xl font-bold text-slate-50">
            {telemetry.temperature.toFixed(1)}
            <span className="ml-1 text-xs font-medium text-slate-400">°C</span>
          </span>
          <span className="font-mono-tabular text-[11px] text-slate-400">
            Batas Alarm &gt; 75.0 °C
          </span>
        </div>

        <TelemetrySparkline
          values={tempValues}
          min={25}
          max={100}
          stroke={tempMeta.stroke}
          fill={tempMeta.fill}
          thresholdY={75}
        />
      </section>

      {/* 3. Sensor Arus (Ampere) - I = P / V */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>3. Sensor Arus (100V Line)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className={`inline-block h-2 w-2 rounded-full ${ampMeta.dotClass}`} />
            <span className={ampMeta.textClass}>{ampMeta.label}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="font-mono-tabular text-2xl font-bold text-slate-50">
            {telemetry.currentAmpere.toFixed(3)}
            <span className="ml-1 text-xs font-medium text-slate-400">A</span>
          </span>
          <span className="font-mono-tabular text-[11px] text-slate-400">
            I = P/V · {telemetry.effectivePowerW.toFixed(1)}W / {telemetry.lineVoltage.toFixed(0)}V
          </span>
        </div>

        <TelemetrySparkline
          values={ampValues}
          min={0}
          max={1.6}
          stroke={ampMeta.stroke}
          fill={ampMeta.fill}
          thresholdY={0.25}
        />

        <button
          type="button"
          onClick={onToggleOverload}
          className={`mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            controls.isOverload
              ? 'border-rose-400 bg-rose-600 text-white hover:bg-rose-500'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200 hover:border-rose-400 hover:bg-rose-900/50'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {controls.isOverload
              ? 'Hentikan Beban Berlebih (Reset)'
              : 'Simulasi Beban Berlebih (Overload)'}
          </span>
        </button>
      </section>
    </aside>
  );
}

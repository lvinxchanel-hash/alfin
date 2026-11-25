import { ChevronDown, ChevronUp, Mic, Music, Radio, Sliders, Square } from 'lucide-react';
import { AudioControlsState, PowerTap, TelemetryState } from '../../types/paSystem';

interface ControlDockProps {
  controls: AudioControlsState;
  telemetry: TelemetryState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTogglePaging: () => void;
  onToggleBgm: () => void;
  onChangeControl: <K extends keyof AudioControlsState>(
    key: K,
    value: AudioControlsState[K]
  ) => void;
}

const POWER_TAPS: PowerTap[] = [3, 6, 10];

export function ControlDock({
  controls,
  telemetry,
  collapsed,
  onToggleCollapse,
  onTogglePaging,
  onToggleBgm,
  onChangeControl,
}: ControlDockProps) {
  return (
    <div className="pointer-events-none flex flex-col items-center">
      {/* Collapse / Expand Toggle Tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 flex cursor-pointer items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-800 bg-slate-950/92 px-3.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-cyan-300 whitespace-nowrap"
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Tampilkan Konsol Kontrol (H)</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Sembunyikan Konsol</span>
          </>
        )}
      </button>

      {!collapsed && (
        <section
          aria-label="Panel Kontrol Eksekusi Audio PA"
          className="pointer-events-auto w-full max-w-[920px] rounded-xl border border-slate-800 bg-slate-950/94 p-3.5 shadow-2xl"
        >
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[260px_1fr_195px] lg:items-center">
            {/* Column 1: Push-to-Talk & BGM Controls */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onTogglePaging}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  controls.isPaging
                    ? 'border-amber-400 bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/25'
                }`}
              >
                <Mic className="h-4 w-4 shrink-0" />
                <span>
                  {controls.isPaging
                    ? 'Paging Aktif (Klik Selesai)'
                    : 'Push-to-Talk (Paging)'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleBgm}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    controls.isBgmPlaying
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {controls.isBgmPlaying ? (
                    <>
                      <Square className="h-3.5 w-3.5 shrink-0 fill-current" />
                      <span>Stop Musik Latar (BGM)</span>
                    </>
                  ) : (
                    <>
                      <Music className="h-3.5 w-3.5 shrink-0" />
                      <span>Play Musik Latar (BGM)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Priority Override Feedback Text */}
              <div className="flex items-center justify-between px-0.5 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Radio
                    className={`h-3 w-3 ${
                      telemetry.priorityRelayActive ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <span>Priority Override</span>
                </span>
                <span
                  className={`font-medium ${
                    telemetry.bgmDucked
                      ? 'text-amber-300'
                      : telemetry.priorityRelayActive
                      ? 'text-cyan-300'
                      : 'text-slate-500'
                  }`}
                >
                  {telemetry.bgmDucked
                    ? 'Aktif · BGM Diredam (-18 dB)'
                    : telemetry.priorityRelayActive
                    ? 'Relay Paging Terhubung'
                    : 'Siaga'}
                </span>
              </div>
            </div>

            {/* Column 2: Interactive Gain, Bass, Treble, Volume Sliders */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 border-y border-slate-800/80 py-2.5 lg:border-x lg:border-y-0 lg:px-5 lg:py-0">
              {/* Gain */}
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Gain (Pre-Amp)</span>
                  <span className="font-mono-tabular text-cyan-300">{controls.gain}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={controls.gain}
                  onChange={(e) => onChangeControl('gain', Number(e.target.value))}
                  className="pa-slider"
                />
              </label>

              {/* Volume */}
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Volume Master</span>
                  <span className="font-mono-tabular text-emerald-300">{controls.volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={controls.volume}
                  onChange={(e) => onChangeControl('volume', Number(e.target.value))}
                  className="pa-slider"
                />
              </label>

              {/* Bass */}
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Bass (180 Hz)</span>
                  <span className="font-mono-tabular text-indigo-300">
                    {controls.bass > 0 ? `+${controls.bass}` : controls.bass} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={controls.bass}
                  onChange={(e) => onChangeControl('bass', Number(e.target.value))}
                  className="pa-slider"
                />
              </label>

              {/* Treble */}
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Treble (3.5 kHz)</span>
                  <span className="font-mono-tabular text-indigo-300">
                    {controls.treble > 0 ? `+${controls.treble}` : controls.treble} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={controls.treble}
                  onChange={(e) => onChangeControl('treble', Number(e.target.value))}
                  className="pa-slider"
                />
              </label>
            </div>

            {/* Column 3: Power Tap Trafo Selector (3W / 6W / 10W) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                  <span>Power Tap Trafo</span>
                </span>
                <span className="font-mono-tabular text-[11px] text-slate-400">100V Line</span>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
                {POWER_TAPS.map((tap) => {
                  const active = controls.powerTap === tap;
                  return (
                    <button
                      key={tap}
                      type="button"
                      onClick={() => onChangeControl('powerTap', tap)}
                      className={`cursor-pointer rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {tap}W
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] leading-snug text-slate-400">
                Tap {controls.powerTap}W menentukan arus beban ({(controls.powerTap / 100).toFixed(2)} A nominal) dan tekanan suara di aula.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

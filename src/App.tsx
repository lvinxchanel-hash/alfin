import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { paAudioEngine } from './audio/paAudioEngine';
import { CAMERA_PRESETS, getLayersByComponent } from './data/componentsData';
import { ControlDock } from './components/hud/ControlDock';
import { ExplodedInspector } from './components/hud/ExplodedInspector';
import { TelemetryHud } from './components/hud/TelemetryHud';
import { PAStageCanvas } from './components/three/PAStageCanvas';
import {
  AudioControlsState,
  FocusTarget,
  TelemetryState,
} from './types/paSystem';

const INITIAL_CONTROLS: AudioControlsState = {
  gain: 70,
  bass: 2,
  treble: 3,
  volume: 75,
  powerTap: 6,
  isPaging: false,
  isBgmPlaying: false,
  isOverload: false,
  isMuted: false,
};

const INITIAL_TELEMETRY: TelemetryState = {
  dbSpl: 35.4,
  temperature: 28.0,
  currentAmpere: 0.008,
  lineVoltage: 100,
  effectivePowerW: 0.8,
  micSignalLevel: 0,
  speakerSignalLevel: 0,
  bgmDucked: false,
  priorityRelayActive: false,
  thermalAlarm: false,
  overloadAlarm: false,
  dbStatus: 'normal',
  tempStatus: 'normal',
  ampStatus: 'normal',
  history: Array.from({ length: 24 }, (_, i) => ({
    t: Date.now() - (24 - i) * 100,
    db: 35.4,
    temp: 28.0,
    amp: 0.008,
  })),
};

const VIEW_TARGETS: FocusTarget[] = ['overview', 'mic', 'mixer', 'speaker'];

export default function App() {
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('overview');
  const [controls, setControls] = useState<AudioControlsState>(INITIAL_CONTROLS);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryState>(INITIAL_TELEMETRY);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [mobileTelemetryOpen, setMobileTelemetryOpen] = useState(false);

  const telemetryRef = useRef<TelemetryState>(INITIAL_TELEMETRY);

  // Sync audio parameters to Web Audio Engine
  useEffect(() => {
    paAudioEngine.updateControls(controls);
  }, [controls]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      paAudioEngine.dispose();
    };
  }, []);

  const handleSelectComponent = useCallback((target: FocusTarget) => {
    setFocusTarget(target);
    if (target === 'overview') {
      setSelectedLayerId(null);
    } else {
      const firstLayer = getLayersByComponent(target)[0];
      setSelectedLayerId(firstLayer ? firstLayer.id : null);
    }
  }, []);

  const handleTogglePaging = useCallback(() => {
    setControls((prev) => {
      const nextPaging = !prev.isPaging;
      if (nextPaging) {
        paAudioEngine.playRelayClick();
        paAudioEngine.startPaging();
      } else {
        paAudioEngine.stopPaging();
        paAudioEngine.playRelayClick();
      }
      return { ...prev, isPaging: nextPaging };
    });
  }, []);

  const handleToggleBgm = useCallback(() => {
    setControls((prev) => {
      const nextBgm = !prev.isBgmPlaying;
      if (nextBgm) {
        paAudioEngine.startBgm();
      } else {
        paAudioEngine.stopBgm();
      }
      return { ...prev, isBgmPlaying: nextBgm };
    });
  }, []);

  const handleToggleOverload = useCallback(() => {
    setControls((prev) => ({ ...prev, isOverload: !prev.isOverload }));
  }, []);

  const handleChangeControl = useCallback(
    <K extends keyof AudioControlsState>(key: K, value: AudioControlsState[K]) => {
      setControls((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleResetView = useCallback(() => {
    setFocusTarget('overview');
    setSelectedLayerId(null);
  }, []);

  // Keyboard shortcuts: H toggles HUD, 1-4 switch views
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setHudHidden((prev) => !prev);
      } else if (e.key === '1') {
        handleSelectComponent('overview');
      } else if (e.key === '2') {
        handleSelectComponent('mic');
      } else if (e.key === '3') {
        handleSelectComponent('mixer');
      } else if (e.key === '4') {
        handleSelectComponent('speaker');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectComponent]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#070b12] text-slate-100">
      {/* Full-Viewport 3D Interactive Canvas */}
      <div className="absolute inset-0 z-0">
        <PAStageCanvas
          focusTarget={focusTarget}
          controls={controls}
          selectedLayerId={selectedLayerId}
          telemetryRef={telemetryRef}
          onTelemetrySync={setTelemetry}
          onSelectComponent={handleSelectComponent}
          onSelectLayer={setSelectedLayerId}
        />
      </div>

      {/* Top Navigation & Exploded View Bar (3-Zone Clean Header) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Zone 1: Brand Title */}
        <div className="pointer-events-auto flex items-center rounded-xl border border-slate-800 bg-slate-950/92 px-3.5 py-2 shadow-lg">
          <h1 className="font-display text-sm font-bold tracking-tight text-slate-50 whitespace-nowrap sm:text-base">
            PA-Sim 3D
          </h1>
        </div>

        {/* Zone 2: Camera & Exploded View Component Selector */}
        <nav
          aria-label="Pemilihan Kamera dan Bedah Komponen"
          className="pointer-events-auto hidden items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/92 p-1 shadow-lg md:flex"
        >
          {VIEW_TARGETS.map((target) => {
            const preset = CAMERA_PRESETS[target];
            const active = focusTarget === target;
            return (
              <button
                key={target}
                type="button"
                onClick={() => handleSelectComponent(target)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick View Actions (Mute & Zen HUD Toggle) */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {focusTarget !== 'overview' && (
            <button
              type="button"
              onClick={handleResetView}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/92 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-200 whitespace-nowrap shadow-lg"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset Kamera</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileTelemetryOpen((prev) => !prev)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/92 px-3 py-2 text-xs font-medium text-cyan-200 transition-colors hover:border-cyan-400/50 whitespace-nowrap shadow-lg lg:hidden"
          >
            <span>{mobileTelemetryOpen ? 'Tutup Telemetri' : 'Telemetri'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleChangeControl('isMuted', !controls.isMuted)}
            title={controls.isMuted ? 'Aktifkan Audio' : 'Bisukan Audio'}
            className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shadow-lg ${
              controls.isMuted
                ? 'border-amber-500/50 bg-amber-950/80 text-amber-200'
                : 'border-slate-800 bg-slate-950/92 text-slate-200 hover:border-slate-700'
            }`}
          >
            {controls.isMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
            )}
            <span className="hidden sm:inline">
              {controls.isMuted ? 'Audio Bisu' : 'Audio Aktif'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setHudHidden((prev) => !prev)}
            title="Sembunyikan/Tampilkan Panel HUD (H)"
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/92 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-700 whitespace-nowrap shadow-lg"
          >
            {hudHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{hudHidden ? 'Tampilkan HUD' : 'Mode Fokus 3D'}</span>
          </button>
        </div>
      </header>

      {/* Mobile View Selector Bar */}
      {!hudHidden && (
        <div className="pointer-events-auto absolute inset-x-4 top-16 z-20 flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/92 p-1 shadow-lg md:hidden">
          {VIEW_TARGETS.map((target) => {
            const preset = CAMERA_PRESETS[target];
            const active = focusTarget === target;
            return (
              <button
                key={target}
                type="button"
                onClick={() => handleSelectComponent(target)}
                className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main HUD Overlay Grid */}
      {!hudHidden && (
        <>
          {/* Left Exploded View Layer Inspector (Visible only when inspecting a component) */}
          {focusTarget !== 'overview' && (
            <div className="pointer-events-none absolute left-4 top-28 z-10 md:left-6 md:top-18">
              <ExplodedInspector
                focusTarget={focusTarget}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onClose={handleResetView}
              />
            </div>
          )}

          {/* Right HUD: 3 Real-Time Telemetry Sensors (dB SPL, Suhu °C, Arus A) */}
          <div
            className={`pointer-events-none absolute right-4 top-28 z-10 md:right-6 md:top-18 ${
              mobileTelemetryOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            <TelemetryHud
              telemetry={telemetry}
              controls={controls}
              onToggleOverload={handleToggleOverload}
            />
          </div>

          {/* Bottom Execution Control Dock */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 px-4">
            <ControlDock
              controls={controls}
              telemetry={telemetry}
              collapsed={dockCollapsed}
              onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
              onTogglePaging={handleTogglePaging}
              onToggleBgm={handleToggleBgm}
              onChangeControl={handleChangeControl}
            />
          </div>
        </>
      )}
    </main>
  );
}

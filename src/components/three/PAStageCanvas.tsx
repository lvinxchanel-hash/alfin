import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { paAudioEngine } from '../../audio/paAudioEngine';
import {
  AudioControlsState,
  FocusTarget,
  SensorStatus,
  TelemetryHistoryPoint,
  TelemetryState,
} from '../../types/paSystem';
import { CameraRig } from './CameraRig';
import { SceneEnvironment } from './SceneEnvironment';
import { PagingMic3D } from './PagingMic3D';
import { MixerAmp3D } from './MixerAmp3D';
import { CeilingSpeaker3D } from './CeilingSpeaker3D';

interface PAStageCanvasProps {
  focusTarget: FocusTarget;
  controls: AudioControlsState;
  selectedLayerId: string | null;
  telemetryRef: React.MutableRefObject<TelemetryState>;
  onTelemetrySync: (snapshot: TelemetryState) => void;
  onSelectComponent: (target: FocusTarget) => void;
  onSelectLayer: (layerId: string) => void;
}

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface TelemetryRunnerProps {
  controls: AudioControlsState;
  telemetryRef: React.MutableRefObject<TelemetryState>;
  onTelemetrySync: (snapshot: TelemetryState) => void;
}

function TelemetryPhysicsRunner({
  controls,
  telemetryRef,
  onTelemetrySync,
}: TelemetryRunnerProps) {
  const syncTimerRef = useRef(0);
  const alarmCooldownRef = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const prev = telemetryRef.current;
    const { speakerRms, micRms } = paAudioEngine.sampleSignalLevels();

    // If audio engine hasn't produced active RMS yet during immediate press, smooth fallback envelope
    const targetMicLevel = controls.isPaging
      ? Math.max(micRms, 0.25 + 0.15 * Math.sin(state.clock.elapsedTime * 14) ** 2)
      : micRms;

    const tapFactor = controls.powerTap / 10; // 0.3, 0.6, 1.0
    const eqBoost = Math.max(0, (controls.bass + controls.treble) * 0.18);
    const volFactor = controls.isMuted ? 0 : controls.volume / 100;
    const gainFactor = 0.4 + (controls.gain / 100) * 0.6;

    const activeBgmLevel = controls.isBgmPlaying
      ? (controls.isPaging ? 0.08 : 0.36) * volFactor
      : 0;
    const activePagingLevel = controls.isPaging
      ? Math.max(speakerRms, 0.55 * gainFactor * volFactor)
      : 0;

    const combinedSignal = Math.min(
      1,
      Math.max(speakerRms, activePagingLevel, activeBgmLevel)
    );

    const smoothSpk = THREE.MathUtils.damp(prev.speakerSignalLevel, combinedSignal, 12, dt);
    const smoothMic = THREE.MathUtils.damp(prev.micSignalLevel, targetMicLevel, 14, dt);

    // 1. Sensor Suara (dB SPL): 30 - 115 dB
    const ambientFloor = 35.5 + Math.sin(state.clock.elapsedTime * 2.1) * 0.45;
    const acousticLift =
      smoothSpk > 0.015
        ? 38 + smoothSpk * (28 + tapFactor * 14) + eqBoost
        : 0;
    const rawDb = THREE.MathUtils.clamp(
      ambientFloor + acousticLift * (0.45 + 0.55 * tapFactor),
      30,
      115
    );
    const dbSpl = THREE.MathUtils.damp(prev.dbSpl, rawDb, 8, dt);

    // 2. Sensor Arus (Ampere) on 100V Line: I = P / V
    const lineVoltage = controls.isOverload ? 91.5 : 100.0;
    const idlePower = 0.8; // Transformer magnetizing standby loss
    const signalDrivePower =
      smoothSpk > 0.015
        ? controls.powerTap * (0.28 + 0.72 * smoothSpk)
        : 0;
    const overloadSurgeW = controls.isOverload
      ? 124 + Math.sin(state.clock.elapsedTime * 19) * 8
      : 0;

    const effectivePowerW = idlePower + signalDrivePower + overloadSurgeW;
    const targetCurrent = effectivePowerW / lineVoltage;
    const currentAmpere = THREE.MathUtils.damp(prev.currentAmpere, targetCurrent, 10, dt);

    // 3. Sensor Suhu (°C): Rises gradually at high speaker power or overload, triggers alarm > 75°C
    const highLoadActive =
      (controls.powerTap >= 6 && smoothSpk > 0.28) || controls.isOverload;
    const heatGeneration =
      controls.isOverload
        ? 5.8
        : controls.powerTap === 10 && smoothSpk > 0.25
        ? 3.1 * smoothSpk
        : controls.powerTap === 6 && smoothSpk > 0.35
        ? 1.25 * smoothSpk
        : 0;

    const ambientTemp = 28.0;
    const coolingRate = (prev.temperature - ambientTemp) * (highLoadActive ? 0.018 : 0.14);
    const nextTemp = THREE.MathUtils.clamp(
      prev.temperature + (heatGeneration - coolingRate) * dt,
      26.0,
      98.0
    );

    const thermalAlarm = nextTemp > 75.0;
    const overloadAlarm = controls.isOverload || currentAmpere > 0.35;

    const dbStatus: SensorStatus =
      dbSpl >= 100 ? 'danger' : dbSpl >= 85 ? 'warning' : 'normal';
    const tempStatus: SensorStatus =
      nextTemp > 75 ? 'danger' : nextTemp >= 55 ? 'warning' : 'normal';
    const ampStatus: SensorStatus =
      currentAmpere > 0.25 || controls.isOverload
        ? 'danger'
        : currentAmpere >= 0.085
        ? 'warning'
        : 'normal';

    // Periodic gentle beep if thermal or overload alarm newly escalates
    alarmCooldownRef.current = Math.max(0, alarmCooldownRef.current - dt);
    if ((thermalAlarm && !prev.thermalAlarm) || (overloadAlarm && !prev.overloadAlarm)) {
      if (alarmCooldownRef.current <= 0 && !controls.isMuted) {
        paAudioEngine.playAlertBeep();
        alarmCooldownRef.current = 4.0;
      }
    }

    syncTimerRef.current += dt;
    let nextHistory = prev.history;
    const shouldSyncUi = syncTimerRef.current >= 0.1;

    if (shouldSyncUi) {
      syncTimerRef.current = 0;
      const point: TelemetryHistoryPoint = {
        t: Date.now(),
        db: Number(dbSpl.toFixed(1)),
        temp: Number(nextTemp.toFixed(1)),
        amp: Number(currentAmpere.toFixed(3)),
      };
      nextHistory = [...prev.history.slice(-39), point];
    }

    const updated: TelemetryState = {
      dbSpl,
      temperature: nextTemp,
      currentAmpere,
      lineVoltage,
      effectivePowerW,
      micSignalLevel: smoothMic,
      speakerSignalLevel: smoothSpk,
      bgmDucked: controls.isPaging && controls.isBgmPlaying,
      priorityRelayActive: controls.isPaging,
      thermalAlarm,
      overloadAlarm,
      dbStatus,
      tempStatus,
      ampStatus,
      history: nextHistory,
    };

    telemetryRef.current = updated;

    if (shouldSyncUi) {
      onTelemetrySync(updated);
    }
  });

  return null;
}

export function PAStageCanvas({
  focusTarget,
  controls,
  selectedLayerId,
  telemetryRef,
  onTelemetrySync,
  onSelectComponent,
  onSelectLayer,
}: PAStageCanvasProps) {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const [contextLost, setContextLost] = useState(false);

  return (
    <div className="relative w-full h-full bg-[#070b12]">
      {contextLost ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-base font-semibold text-slate-100">
            Konteks WebGL terhenti sementara
          </p>
          <p className="max-w-md text-sm text-slate-400">
            Peramban sedang memulihkan akselerasi grafis 3D untuk PA-Sim 3D.
          </p>
        </div>
      ) : (
        <Canvas
          shadows={!isSoftwareGl}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          camera={{ position: [0.4, 4.15, 7.35], fov: 44, near: 0.1, far: 80 }}
          gl={{
            antialias: !isSoftwareGl,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            const dom = gl.domElement;
            dom.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setContextLost(true);
            });
            dom.addEventListener('webglcontextrestored', () => {
              setContextLost(false);
            });
          }}
          onPointerMissed={() => {
            if (focusTarget === 'overview') return;
          }}
        >
          <TelemetryPhysicsRunner
            controls={controls}
            telemetryRef={telemetryRef}
            onTelemetrySync={onTelemetrySync}
          />

          <SceneEnvironment
            focusTarget={focusTarget}
            controls={controls}
            telemetryRef={telemetryRef}
            isSoftwareGl={isSoftwareGl}
          />

          <PagingMic3D
            isExploded={focusTarget === 'mic'}
            controls={controls}
            telemetryRef={telemetryRef}
            selectedLayerId={selectedLayerId}
            onSelectComponent={() => onSelectComponent('mic')}
            onSelectLayer={onSelectLayer}
          />

          <MixerAmp3D
            isExploded={focusTarget === 'mixer'}
            controls={controls}
            telemetryRef={telemetryRef}
            selectedLayerId={selectedLayerId}
            onSelectComponent={() => onSelectComponent('mixer')}
            onSelectLayer={onSelectLayer}
          />

          <CeilingSpeaker3D
            isExploded={focusTarget === 'speaker'}
            controls={controls}
            telemetryRef={telemetryRef}
            selectedLayerId={selectedLayerId}
            onSelectComponent={() => onSelectComponent('speaker')}
            onSelectLayer={onSelectLayer}
          />

          <CameraRig focusTarget={focusTarget} isSoftwareGl={isSoftwareGl} />
        </Canvas>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  createBrushedMetalTexture,
  createPcbTexture,
} from '../../utils/textures';
import { AudioControlsState, TelemetryState } from '../../types/paSystem';
import { getLayersByComponent } from '../../data/componentsData';

interface MixerAmp3DProps {
  isExploded: boolean;
  controls: AudioControlsState;
  telemetryRef: React.MutableRefObject<TelemetryState>;
  selectedLayerId: string | null;
  onSelectComponent: () => void;
  onSelectLayer: (layerId: string) => void;
}

export function MixerAmp3D({
  isExploded,
  controls,
  telemetryRef,
  selectedLayerId,
  onSelectComponent,
  onSelectLayer,
}: MixerAmp3DProps) {
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const explodeProgress = useRef(0);

  const topLidRef = useRef<THREE.Mesh>(null);
  const blockRefs = useRef<(THREE.Group | null)[]>([]);
  const relayArmatureRef = useRef<THREE.Mesh>(null);
  const relayLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const vuLedsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const layers = useMemo(() => getLayersByComponent('mixer'), []);

  const textures = useMemo(() => {
    return {
      chassis: createBrushedMetalTexture('#1b2332'),
      pcb: createPcbTexture(),
    };
  }, []);

  useEffect(() => {
    return () => {
      textures.chassis.dispose();
      textures.pcb.dispose();
    };
  }, [textures]);

  const relayAnimRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = isExploded ? 1 : 0;
    explodeProgress.current = THREE.MathUtils.damp(explodeProgress.current, target, 5.5, dt);
    const t = explodeProgress.current;

    // Lift top lid smoothly so all 5 internal circuit blocks are exposed
    if (topLidRef.current) {
      topLidRef.current.position.y = THREE.MathUtils.lerp(0.085, 0.56, t);
      topLidRef.current.position.z = THREE.MathUtils.lerp(0, -0.08, t);
      topLidRef.current.rotation.x = THREE.MathUtils.lerp(0, -0.18, t);
    }

    // Float each of the 5 circuit blocks cleanly upward in staggered steps
    blockRefs.current.forEach((grp, idx) => {
      if (!grp) return;
      const lift = t * (0.14 + (idx % 2 === 0 ? 0.06 : 0.14));
      grp.position.y = lift;
    });

    // Animate Priority Override Relay armature snapping closed when Paging Mic is pressed!
    const relayTarget = controls.isPaging ? 1 : 0;
    relayAnimRef.current = THREE.MathUtils.damp(relayAnimRef.current, relayTarget, 18, dt);
    if (relayArmatureRef.current) {
      relayArmatureRef.current.rotation.z = THREE.MathUtils.lerp(0.28, 0.0, relayAnimRef.current);
    }
    if (relayLedMatRef.current) {
      const active = controls.isPaging;
      relayLedMatRef.current.emissiveIntensity = active ? 2.2 : 0.15;
    }

    // Animate Front Panel 8-Segment VU Meter LEDs
    const sig = telemetryRef.current.speakerSignalLevel;
    vuLedsRef.current.forEach((mat, idx) => {
      if (!mat) return;
      const threshold = (idx + 1) / 8;
      const lit = sig >= threshold * 0.85;
      mat.emissiveIntensity = lit ? 1.8 : 0.08;
    });
  });

  const handleLayerClick = (e: ThreeEvent<MouseEvent>, layerId: string) => {
    e.stopPropagation();
    if (!isExploded) {
      onSelectComponent();
    }
    onSelectLayer(layerId);
  };

  const getEmissive = (layerId: string) => {
    if (selectedLayerId === layerId) return '#22d3ee';
    if (hoveredLayer === layerId) return '#38bdf8';
    return '#000000';
  };

  const getEmissiveIntensity = (layerId: string) => {
    if (selectedLayerId === layerId) return 0.5;
    if (hoveredLayer === layerId) return 0.25;
    return 0;
  };

  const activeLayerObj = layers.find((l) => l.id === selectedLayerId);
  const blockXPositions = [-0.21, -0.105, 0.0, 0.105, 0.21];
  const selectedBlockIdx = layers.findIndex((l) => l.id === selectedLayerId);

  return (
    <group position={[-4.4, 1.05, -1.25]} rotation={[0, 0.35, 0]}>
      {/* Main Chassis Base & Front Faceplate */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelectComponent();
        }}
      >
        {/* Bottom Tray */}
        <mesh position={[0, -0.07, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.02, 0.48]} />
          <meshStandardMaterial map={textures.chassis} color="#1e293b" roughness={0.45} metalness={0.8} />
        </mesh>
        {/* Side & Rear Walls */}
        <mesh position={[-0.3, 0.005, 0]}>
          <boxGeometry args={[0.02, 0.14, 0.48]} />
          <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.78} />
        </mesh>
        <mesh position={[0.3, 0.005, 0]}>
          <boxGeometry args={[0.02, 0.14, 0.48]} />
          <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.78} />
        </mesh>
        <mesh position={[0, 0.005, -0.23]}>
          <boxGeometry args={[0.62, 0.14, 0.02]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.7} />
        </mesh>

        {/* Front 19-Inch Brushed Faceplate */}
        <mesh position={[0, 0.005, 0.245]} castShadow>
          <boxGeometry args={[0.66, 0.16, 0.02]} />
          <meshStandardMaterial map={textures.chassis} color="#111827" roughness={0.35} metalness={0.85} />
        </mesh>

        {/* Front Panel Rotary Knobs synced with Gain, Bass, Treble, Volume */}
        {[
          { x: -0.21, norm: controls.gain / 100, color: '#38bdf8' },
          { x: -0.12, norm: (controls.bass + 12) / 24, color: '#818cf8' },
          { x: -0.05, norm: (controls.treble + 12) / 24, color: '#818cf8' },
          { x: 0.06, norm: controls.volume / 100, color: '#10b981' },
        ].map((knob, idx) => (
          <group
            key={idx}
            position={[knob.x, 0.0, 0.265]}
            rotation={[Math.PI / 2, 0, THREE.MathUtils.lerp(-2.2, 2.2, knob.norm)]}
          >
            <mesh>
              <cylinderGeometry args={[0.02, 0.022, 0.024, 20]} />
              <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
            </mesh>
            <mesh position={[0, 0.013, -0.01]}>
              <boxGeometry args={[0.004, 0.004, 0.014]} />
              <meshStandardMaterial color={knob.color} emissive={knob.color} emissiveIntensity={0.9} />
            </mesh>
          </group>
        ))}

        {/* Front Panel Priority Override Status Indicator */}
        <mesh position={[0.0, 0.048, 0.258]}>
          <boxGeometry args={[0.045, 0.016, 0.006]} />
          <meshStandardMaterial
            color={controls.isPaging ? '#f59e0b' : '#1e293b'}
            emissive={controls.isPaging ? '#f59e0b' : '#000000'}
            emissiveIntensity={controls.isPaging ? 1.8 : 0}
          />
        </mesh>

        {/* Front Panel 8-Segment VU Meter LEDs */}
        {Array.from({ length: 8 }).map((_, idx) => {
          const ledColor = idx < 5 ? '#10b981' : idx < 7 ? '#f59e0b' : '#ef4444';
          return (
            <mesh key={idx} position={[0.14 + idx * 0.018, 0.01, 0.258]}>
              <boxGeometry args={[0.012, 0.026, 0.006]} />
              <meshStandardMaterial
                ref={(el) => {
                  vuLedsRef.current[idx] = el;
                }}
                color={ledColor}
                emissive={ledColor}
                emissiveIntensity={0.1}
              />
            </mesh>
          );
        })}

        {/* Main PCB Motherboard inside Chassis */}
        <mesh position={[0, -0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.56, 0.42]} />
          <meshStandardMaterial map={textures.pcb} roughness={0.45} metalness={0.25} />
        </mesh>
      </group>

      {/* Removable Top Cover (Lifts smoothly in Exploded View) */}
      <mesh ref={topLidRef} position={[0, 0.085, 0]} castShadow>
        <boxGeometry args={[0.62, 0.018, 0.48]} />
        <meshStandardMaterial
          map={textures.chassis}
          color="#263142"
          roughness={0.38}
          metalness={0.82}
        />
      </mesh>

      {/* ==================== 5 INTERNAL CIRCUIT BLOCKS ==================== */}
      {/* BLOCK 1: Gain / Pre-Amp */}
      <group
        ref={(el) => {
          blockRefs.current[0] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'mixer-1-gain')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('mixer-1-gain');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group position={[-0.21, -0.01, 0.02]}>
          <mesh>
            <boxGeometry args={[0.085, 0.055, 0.24]} />
            <meshStandardMaterial
              color="#0284c7"
              roughness={0.35}
              metalness={0.45}
              emissive={getEmissive('mixer-1-gain')}
              emissiveIntensity={getEmissiveIntensity('mixer-1-gain')}
            />
          </mesh>
          {/* Low-noise Pre-Amp IC & Input Transformer Can */}
          <mesh position={[0, 0.042, -0.05]}>
            <cylinderGeometry args={[0.024, 0.024, 0.04, 20]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.92} />
          </mesh>
          <mesh position={[0, 0.036, 0.05]}>
            <boxGeometry args={[0.045, 0.018, 0.055]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      </group>

      {/* BLOCK 2: Tone Control (Bass & Treble) */}
      <group
        ref={(el) => {
          blockRefs.current[1] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'mixer-2-tone')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('mixer-2-tone');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group position={[-0.105, -0.01, 0.02]}>
          <mesh>
            <boxGeometry args={[0.085, 0.05, 0.24]} />
            <meshStandardMaterial
              color="#4f46e5"
              roughness={0.38}
              metalness={0.4}
              emissive={getEmissive('mixer-2-tone')}
              emissiveIntensity={getEmissiveIntensity('mixer-2-tone')}
            />
          </mesh>
          {/* EQ Film Capacitors */}
          {[-0.06, 0.0, 0.06].map((zOff, i) => (
            <mesh key={i} position={[0, 0.04, zOff]}>
              <boxGeometry args={[0.036, 0.03, 0.022]} />
              <meshStandardMaterial color="#a5b4fc" roughness={0.3} metalness={0.2} />
            </mesh>
          ))}
        </group>
      </group>

      {/* BLOCK 3: Sirkuit Priority Override (Animated Electromechanical Relay!) */}
      <group
        ref={(el) => {
          blockRefs.current[2] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'mixer-3-priority')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('mixer-3-priority');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group position={[0.0, -0.01, 0.02]}>
          <mesh>
            <boxGeometry args={[0.09, 0.052, 0.25]} />
            <meshStandardMaterial
              color="#d97706"
              roughness={0.35}
              metalness={0.45}
              emissive={controls.isPaging ? '#f59e0b' : getEmissive('mixer-3-priority')}
              emissiveIntensity={controls.isPaging ? 0.45 : getEmissiveIntensity('mixer-3-priority')}
            />
          </mesh>
          {/* Relay Copper Solenoid Coil */}
          <mesh position={[-0.015, 0.052, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.035, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Moving Relay Armature Contact Arm */}
          <mesh ref={relayArmatureRef} position={[0.018, 0.068, 0]}>
            <boxGeometry args={[0.035, 0.008, 0.028]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.95} />
          </mesh>
          {/* Transparent Relay Housing */}
          <mesh position={[0, 0.056, 0]}>
            <boxGeometry args={[0.072, 0.055, 0.085]} />
            <meshStandardMaterial
              color="#fde68a"
              transparent
              opacity={0.26}
              roughness={0.1}
              depthWrite={false}
            />
          </mesh>
          {/* Relay Active Status LED */}
          <mesh position={[0, 0.042, 0.085]}>
            <sphereGeometry args={[0.012, 12, 12]} />
            <meshStandardMaterial
              ref={relayLedMatRef}
              color="#fbbf24"
              emissive="#f59e0b"
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>
      </group>

      {/* BLOCK 4: Mixer / Volume */}
      <group
        ref={(el) => {
          blockRefs.current[3] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'mixer-4-master')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('mixer-4-master');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group position={[0.105, -0.01, 0.02]}>
          <mesh>
            <boxGeometry args={[0.085, 0.052, 0.24]} />
            <meshStandardMaterial
              color="#059669"
              roughness={0.35}
              metalness={0.45}
              emissive={getEmissive('mixer-4-master')}
              emissiveIntensity={getEmissiveIntensity('mixer-4-master')}
            />
          </mesh>
          {/* Summing Bus Dual Potentiometer Blocks */}
          <mesh position={[0, 0.042, 0.04]}>
            <boxGeometry args={[0.052, 0.028, 0.052]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.042, -0.05]}>
            <cylinderGeometry args={[0.018, 0.018, 0.036, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      </group>

      {/* BLOCK 5: Output Buffer (Line-Level & 100V Driver) */}
      <group
        ref={(el) => {
          blockRefs.current[4] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'mixer-5-buffer')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('mixer-5-buffer');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group position={[0.21, -0.01, 0.02]}>
          <mesh>
            <boxGeometry args={[0.085, 0.055, 0.24]} />
            <meshStandardMaterial
              color="#0891b2"
              roughness={0.35}
              metalness={0.5}
              emissive={getEmissive('mixer-5-buffer')}
              emissiveIntensity={getEmissiveIntensity('mixer-5-buffer')}
            />
          </mesh>
          {/* 100V Step-up Output Buffer Transformer */}
          <mesh position={[0, 0.048, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.026, 0.012, 12, 24]} />
            <meshStandardMaterial color="#d97706" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Finned Power Heatsink */}
          {[-0.02, 0, 0.02].map((xFin, i) => (
            <mesh key={i} position={[xFin, 0.045, 0.06]}>
              <boxGeometry args={[0.008, 0.038, 0.07]} />
              <meshStandardMaterial color="#64748b" roughness={0.28} metalness={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Floating Tooltip for Selected Circuit Block in Exploded View */}
      {isExploded && activeLayerObj && (
        <Html
          position={[blockXPositions[Math.max(0, selectedBlockIdx)], 0.34, 0.02]}
          center
          distanceFactor={2.9}
        >
          <div className="pointer-events-none w-56 rounded-lg border border-amber-400/50 bg-slate-950/95 p-2.5 shadow-xl">
            <div className="text-xs font-semibold text-amber-300">{activeLayerObj.shortLabel}</div>
            <div className="mt-1 text-[11px] leading-snug text-slate-300">
              {activeLayerObj.description}
            </div>
          </div>
        </Html>
      )}

      {/* Overview Clickable Badge */}
      {!isExploded && (
        <Html position={[0, 0.36, 0.26]} center distanceFactor={9}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectComponent();
            }}
            className="cursor-pointer rounded-md border border-amber-400/40 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition-colors hover:border-amber-300 hover:bg-slate-900 whitespace-nowrap shadow-md"
          >
            Pre-Amp / Mixer
          </button>
        </Html>
      )}
    </group>
  );
}

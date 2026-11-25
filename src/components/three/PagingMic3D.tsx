import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  createAcousticFoamTexture,
  createCopperWindingTexture,
  createPerforatedGrilleTexture,
} from '../../utils/textures';
import { AudioControlsState, TelemetryState } from '../../types/paSystem';
import { getLayersByComponent } from '../../data/componentsData';

interface PagingMic3DProps {
  isExploded: boolean;
  controls: AudioControlsState;
  telemetryRef: React.MutableRefObject<TelemetryState>;
  selectedLayerId: string | null;
  onSelectComponent: () => void;
  onSelectLayer: (layerId: string) => void;
}

export function PagingMic3D({
  isExploded,
  controls,
  telemetryRef,
  selectedLayerId,
  onSelectComponent,
  onSelectLayer,
}: PagingMic3DProps) {
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const explodeProgress = useRef(0);

  const layerRefs = useRef<(THREE.Group | null)[]>([]);
  const diaphragmRef = useRef<THREE.Mesh>(null);
  const guideLineRef = useRef<THREE.Mesh>(null);

  const layers = useMemo(() => getLayersByComponent('mic'), []);

  const textures = useMemo(() => {
    return {
      grille: createPerforatedGrilleTexture('#94a3b8', '#0f172a', 5, 3),
      foam: createAcousticFoamTexture(),
      copper: createCopperWindingTexture(),
    };
  }, []);

  useEffect(() => {
    return () => {
      textures.grille.dispose();
      textures.foam.dispose();
      textures.copper.dispose();
    };
  }, [textures]);

  // Base local Z offsets (assembled vs exploded along capsule forward axis)
  const offsets = useMemo(
    () => [
      { id: 'mic-1-grille', assembled: 0.095, exploded: 0.56 },
      { id: 'mic-2-foam', assembled: 0.07, exploded: 0.4 },
      { id: 'mic-3-diaphragm', assembled: 0.042, exploded: 0.25 },
      { id: 'mic-4-coil', assembled: 0.018, exploded: 0.1 },
      { id: 'mic-5-magnet', assembled: -0.025, exploded: -0.06 },
      { id: 'mic-6-housing', assembled: -0.08, exploded: -0.24 },
      { id: 'mic-7-cable', assembled: -0.155, exploded: -0.44 },
    ],
    []
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = isExploded ? 1 : 0;
    explodeProgress.current = THREE.MathUtils.damp(explodeProgress.current, target, 6.0, dt);

    const t = explodeProgress.current;
    offsets.forEach((off, idx) => {
      const grp = layerRefs.current[idx];
      if (grp) {
        grp.position.z = THREE.MathUtils.lerp(off.assembled, off.exploded, t);
      }
    });

    if (guideLineRef.current) {
      guideLineRef.current.visible = t > 0.04;
      guideLineRef.current.scale.set(1, t, 1);
    }

    // Dynamic vibration on Diafragma Mylar & Voice Coil when Paging vocal/chime is active
    if (diaphragmRef.current) {
      const tel = telemetryRef.current;
      const activeAmp = controls.isPaging ? Math.max(0.22, tel.micSignalLevel) : tel.micSignalLevel;
      const vib = activeAmp > 0.02 ? Math.sin(state.clock.elapsedTime * 58) * 0.009 * activeAmp : 0;
      diaphragmRef.current.position.z = vib;
      const coilGrp = layerRefs.current[3];
      if (coilGrp) {
        coilGrp.position.z += vib * 0.85;
      }
    }
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
    if (selectedLayerId === layerId) return 0.55;
    if (hoveredLayer === layerId) return 0.3;
    return 0;
  };

  const activeLayerObj = layers.find((l) => l.id === selectedLayerId);

  return (
    <group position={[-2.85, 0.81, 0.45]} rotation={[0, 0.25, 0]}>
      {/* Desk Paging Console Base */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelectComponent();
        }}
      >
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.05, 0.26]} />
          <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} />
        </mesh>
        {/* Slanted Front Control Panel on Mic Base */}
        <mesh position={[0, 0.045, 0.06]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.18, 0.02, 0.11]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.5} />
        </mesh>
        {/* PTT Physical Button on Desk Console */}
        <mesh position={[0, 0.056, 0.08]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.085, 0.012, 0.04]} />
          <meshStandardMaterial
            color={controls.isPaging ? '#f59e0b' : '#334155'}
            emissive={controls.isPaging ? '#f59e0b' : '#000000'}
            emissiveIntensity={controls.isPaging ? 1.5 : 0}
            roughness={0.3}
          />
        </mesh>
        {/* Status Ring LED around Mic Stem */}
        <mesh position={[0, 0.055, -0.05]}>
          <cylinderGeometry args={[0.025, 0.025, 0.015, 24]} />
          <meshStandardMaterial
            color={controls.isPaging ? '#22d3ee' : '#10b981'}
            emissive={controls.isPaging ? '#22d3ee' : '#059669'}
            emissiveIntensity={controls.isPaging ? 1.8 : 0.6}
          />
        </mesh>
        {/* Gooseneck Vertical Stem */}
        <mesh position={[0, 0.27, -0.04]} castShadow>
          <cylinderGeometry args={[0.012, 0.014, 0.44, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
        </mesh>
        {/* Gooseneck Bend Joint */}
        <mesh position={[0, 0.49, -0.015]} rotation={[0.6, 0, 0]} castShadow>
          <cylinderGeometry args={[0.013, 0.013, 0.08, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.85} />
        </mesh>
      </group>

      {/* ==================== 7-LAYER CAPSULE ASSEMBLY (EXPLODABLE) ==================== */}
      <group position={[0, 0.51, 0.02]} rotation={[-0.22, 0, 0]}>
        {/* Explosion Axis Center Guide Rod */}
        <mesh
          ref={guideLineRef}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, 0.06]}
          visible={false}
        >
          <cylinderGeometry args={[0.0025, 0.0025, 1.05, 8]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.45} />
        </mesh>

        {/* LAYER 1: Grille Logam */}
        <group
          ref={(el) => {
            layerRefs.current[0] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-1-grille')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-1-grille');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <sphereGeometry args={[0.066, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial
              map={textures.grille}
              color="#cbd5e1"
              roughness={0.28}
              metalness={0.85}
              emissive={getEmissive('mic-1-grille')}
              emissiveIntensity={getEmissiveIntensity('mic-1-grille')}
            />
          </mesh>
          {/* Chrome Equatorial Trim Ring */}
          <mesh position={[0, 0, -0.016]}>
            <torusGeometry args={[0.064, 0.005, 10, 32]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.95} />
          </mesh>
        </group>

        {/* LAYER 2: Foam / Filter Akustik */}
        <group
          ref={(el) => {
            layerRefs.current[1] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-2-foam')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-2-foam');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.056, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            <meshStandardMaterial
              map={textures.foam}
              color="#1e293b"
              roughness={0.95}
              metalness={0.0}
              emissive={getEmissive('mic-2-foam')}
              emissiveIntensity={getEmissiveIntensity('mic-2-foam')}
            />
          </mesh>
        </group>

        {/* LAYER 3: Diafragma Mylar (Vibrates dynamically with sound!) */}
        <group
          ref={(el) => {
            layerRefs.current[2] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-3-diaphragm')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-3-diaphragm');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh ref={diaphragmRef} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.004, 32]} />
            <meshPhysicalMaterial
              color="#67e8f9"
              transparent
              opacity={0.78}
              roughness={0.12}
              metalness={0.25}
              clearcoat={1}
              emissive={controls.isPaging ? '#06b6d4' : getEmissive('mic-3-diaphragm')}
              emissiveIntensity={controls.isPaging ? 0.45 : getEmissiveIntensity('mic-3-diaphragm')}
            />
          </mesh>
          {/* Diaphragm Surround Ring */}
          <mesh>
            <torusGeometry args={[0.048, 0.004, 10, 32]} />
            <meshStandardMaterial color="#0ea5e9" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>

        {/* LAYER 4: Kumparan Suara / Voice Coil */}
        <group
          ref={(el) => {
            layerRefs.current[3] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-4-coil')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-4-coil');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 0.024, 28, 1, true]} />
            <meshStandardMaterial
              map={textures.copper}
              color="#f59e0b"
              roughness={0.3}
              metalness={0.85}
              side={THREE.DoubleSide}
              emissive={getEmissive('mic-4-coil')}
              emissiveIntensity={getEmissiveIntensity('mic-4-coil')}
            />
          </mesh>
        </group>

        {/* LAYER 5: Magnet Permanen */}
        <group
          ref={(el) => {
            layerRefs.current[4] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-5-magnet')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-5-magnet');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          {/* Outer Ferrite/NdFeB Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.032, 28]} />
            <meshStandardMaterial
              color="#64748b"
              roughness={0.22}
              metalness={0.92}
              emissive={getEmissive('mic-5-magnet')}
              emissiveIntensity={getEmissiveIntensity('mic-5-magnet')}
            />
          </mesh>
          {/* Red/Blue Pole Indicator Band */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.008]}>
            <cylinderGeometry args={[0.041, 0.041, 0.009, 28]} />
            <meshStandardMaterial color="#e11d48" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>

        {/* LAYER 6: Rumah Kapsul */}
        <group
          ref={(el) => {
            layerRefs.current[5] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-6-housing')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-6-housing');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.038, 0.09, 28]} />
            <meshStandardMaterial
              color="#334155"
              roughness={0.38}
              metalness={0.82}
              emissive={getEmissive('mic-6-housing')}
              emissiveIntensity={getEmissiveIntensity('mic-6-housing')}
            />
          </mesh>
        </group>

        {/* LAYER 7: Kabel Sinyal Lemah (mV) */}
        <group
          ref={(el) => {
            layerRefs.current[6] = el;
          }}
          onClick={(e) => handleLayerClick(e, 'mic-7-cable')}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLayer('mic-7-cable');
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredLayer(null);
            document.body.style.cursor = 'auto';
          }}
        >
          {/* XLR 3-Pin Connector Collar */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.024, 0.055, 20]} />
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.3}
              metalness={0.85}
              emissive={getEmissive('mic-7-cable')}
              emissiveIntensity={getEmissiveIntensity('mic-7-cable')}
            />
          </mesh>
          {/* 3 Gold XLR Pins */}
          {[-0.009, 0, 0.009].map((xP, idx) => (
            <mesh key={idx} position={[xP, idx === 1 ? 0.008 : -0.004, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0025, 0.0025, 0.016, 10]} />
              <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.95} />
            </mesh>
          ))}
          {/* Shielded mV Cable Strain Relief */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
            <cylinderGeometry args={[0.011, 0.009, 0.06, 14]} />
            <meshStandardMaterial color="#0891b2" roughness={0.45} metalness={0.3} />
          </mesh>
        </group>

        {/* Interactive 3D Floating Tooltip when Exploded & Layer Selected */}
        {isExploded && activeLayerObj && (
          <Html
            position={[
              0,
              0.14,
              offsets.find((o) => o.id === activeLayerObj.id)?.exploded ?? 0,
            ]}
            center
            distanceFactor={2.6}
          >
            <div className="pointer-events-none w-56 rounded-lg border border-cyan-400/50 bg-slate-950/95 p-2.5 shadow-xl">
              <div className="text-xs font-semibold text-cyan-300">{activeLayerObj.shortLabel}</div>
              <div className="mt-1 text-[11px] leading-snug text-slate-300">
                {activeLayerObj.description}
              </div>
            </div>
          </Html>
        )}
      </group>

      {/* Overview Clickable Badge */}
      {!isExploded && (
        <Html position={[0, 0.72, 0]} center distanceFactor={9}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectComponent();
            }}
            className="cursor-pointer rounded-md border border-cyan-400/40 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition-colors hover:border-cyan-300 hover:bg-slate-900 whitespace-nowrap shadow-md"
          >
            Mikrofon Paging
          </button>
        </Html>
      )}
    </group>
  );
}

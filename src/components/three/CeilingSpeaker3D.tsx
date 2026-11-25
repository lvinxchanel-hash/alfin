import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  createCopperWindingTexture,
  createPerforatedGrilleTexture,
} from '../../utils/textures';
import { AudioControlsState, TelemetryState } from '../../types/paSystem';
import { getLayersByComponent } from '../../data/componentsData';

interface CeilingSpeaker3DProps {
  isExploded: boolean;
  controls: AudioControlsState;
  telemetryRef: React.MutableRefObject<TelemetryState>;
  selectedLayerId: string | null;
  onSelectComponent: () => void;
  onSelectLayer: (layerId: string) => void;
}

export function CeilingSpeaker3D({
  isExploded,
  controls,
  telemetryRef,
  selectedLayerId,
  onSelectComponent,
  onSelectLayer,
}: CeilingSpeaker3DProps) {
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const explodeProgress = useRef(0);

  const layerRefs = useRef<(THREE.Group | null)[]>([]);
  const coneGroupRef = useRef<THREE.Group>(null);
  const voiceCoilMoveRef = useRef<THREE.Group>(null);
  const guideRodRef = useRef<THREE.Mesh>(null);

  const layers = useMemo(() => getLayersByComponent('speaker'), []);

  const textures = useMemo(() => {
    return {
      grille: createPerforatedGrilleTexture('#cbd5e1', '#0f172a', 6, 6),
      copper: createCopperWindingTexture(),
    };
  }, []);

  useEffect(() => {
    return () => {
      textures.grille.dispose();
      textures.copper.dispose();
    };
  }, [textures]);

  // 6 vertical Y offsets from Ceiling mounting plane (y = 3.55) downward
  const offsets = useMemo(
    () => [
      { id: 'spk-1-trafo', assembled: 0.11, exploded: -0.04 },
      { id: 'spk-2-coil', assembled: 0.04, exploded: -0.3 },
      { id: 'spk-3-magnet', assembled: 0.03, exploded: -0.52 },
      { id: 'spk-4-spider', assembled: -0.015, exploded: -0.74 },
      { id: 'spk-5-cone', assembled: -0.04, exploded: -0.96 },
      { id: 'spk-6-grille', assembled: -0.075, exploded: -1.2 },
    ],
    []
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = isExploded ? 1 : 0;
    explodeProgress.current = THREE.MathUtils.damp(explodeProgress.current, target, 5.5, dt);
    const t = explodeProgress.current;

    offsets.forEach((off, idx) => {
      const grp = layerRefs.current[idx];
      if (grp) {
        grp.position.y = THREE.MathUtils.lerp(off.assembled, off.exploded, t);
      }
    });

    if (guideRodRef.current) {
      guideRodRef.current.visible = t > 0.04;
      guideRodRef.current.scale.set(1, t, 1);
    }

    // Dynamic Cone & Voice Coil Excursion driven by live audio amplitude + Power Tap
    const tel = telemetryRef.current;
    const tapBoost = controls.powerTap === 10 ? 1.0 : controls.powerTap === 6 ? 0.72 : 0.45;
    const amp = tel.speakerSignalLevel;
    const excursion =
      amp > 0.015
        ? Math.sin(state.clock.elapsedTime * 38) * 0.022 * amp * tapBoost
        : 0;

    if (coneGroupRef.current) {
      coneGroupRef.current.position.y = excursion;
    }
    if (voiceCoilMoveRef.current) {
      voiceCoilMoveRef.current.position.y = excursion;
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
    if (selectedLayerId === layerId) return 0.5;
    if (hoveredLayer === layerId) return 0.25;
    return 0;
  };

  const activeLayerObj = layers.find((l) => l.id === selectedLayerId);

  // Power tap indicator X offset on Matching Transformer (-0.055 for 3W, 0 for 6W, +0.055 for 10W)
  const tapX = controls.powerTap === 3 ? -0.055 : controls.powerTap === 6 ? 0 : 0.055;

  return (
    <group position={[2.8, 3.55, 0.0]}>
      {/* Ceiling Mounting Trim Collar (fixed in ceiling plenum) */}
      <mesh position={[0, 0.0, 0]}>
        <cylinderGeometry args={[0.37, 0.37, 0.06, 36, 1, true]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Exploded Vertical Alignment Guide Axis */}
      <mesh ref={guideRodRef} position={[0, -0.62, 0]} visible={false}>
        <cylinderGeometry args={[0.004, 0.004, 1.18, 10]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.45} />
      </mesh>

      {/* LAYER 1: Trafo Matching (3W / 6W / 10W) */}
      <group
        ref={(el) => {
          layerRefs.current[0] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'spk-1-trafo')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('spk-1-trafo');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Laminated Iron Core */}
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.11, 0.12]} />
          <meshStandardMaterial
            color="#475569"
            roughness={0.35}
            metalness={0.85}
            emissive={getEmissive('spk-1-trafo')}
            emissiveIntensity={getEmissiveIntensity('spk-1-trafo')}
          />
        </mesh>
        {/* Copper Transformer Bobbin */}
        <mesh>
          <boxGeometry args={[0.11, 0.085, 0.145]} />
          <meshStandardMaterial map={textures.copper} color="#f59e0b" roughness={0.3} metalness={0.82} />
        </mesh>
        {/* 3W / 6W / 10W Power Tap Terminal Block */}
        <mesh position={[0, 0.07, 0.05]}>
          <boxGeometry args={[0.16, 0.025, 0.04]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* 3 Terminal Posts (3W, 6W, 10W) */}
        {([-0.055, 0, 0.055] as const).map((xPos, i) => {
          const tapVal = i === 0 ? 3 : i === 1 ? 6 : 10;
          const isSelectedTap = controls.powerTap === tapVal;
          return (
            <mesh key={tapVal} position={[xPos, 0.09, 0.05]}>
              <cylinderGeometry args={[0.01, 0.01, 0.022, 12]} />
              <meshStandardMaterial
                color={isSelectedTap ? '#22d3ee' : '#64748b'}
                emissive={isSelectedTap ? '#06b6d4' : '#000000'}
                emissiveIntensity={isSelectedTap ? 1.8 : 0}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
          );
        })}
        {/* Active Tap Jumper Collar */}
        <mesh position={[tapX, 0.105, 0.05]}>
          <boxGeometry args={[0.026, 0.012, 0.026]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} />
        </mesh>
      </group>

      {/* LAYER 2: Kumparan Suara (Voice Coil) */}
      <group
        ref={(el) => {
          layerRefs.current[1] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'spk-2-coil')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('spk-2-coil');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group ref={voiceCoilMoveRef}>
          <mesh>
            <cylinderGeometry args={[0.072, 0.072, 0.085, 32, 1, true]} />
            <meshStandardMaterial
              map={textures.copper}
              color="#fb923c"
              roughness={0.28}
              metalness={0.88}
              side={THREE.DoubleSide}
              emissive={getEmissive('spk-2-coil')}
              emissiveIntensity={getEmissiveIntensity('spk-2-coil')}
            />
          </mesh>
          {/* Kapton Former */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 32, 1, true]} />
            <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* LAYER 3: Magnet Permanen */}
      <group
        ref={(el) => {
          layerRefs.current[2] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'spk-3-magnet')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('spk-3-magnet');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Top Steel Plate */}
        <mesh position={[0, 0.036, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.014, 32]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.92} />
        </mesh>
        {/* Ferrite Magnet Ring */}
        <mesh>
          <cylinderGeometry args={[0.145, 0.145, 0.056, 32]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.65}
            metalness={0.35}
            emissive={getEmissive('spk-3-magnet')}
            emissiveIntensity={getEmissiveIntensity('spk-3-magnet')}
          />
        </mesh>
        {/* Bottom Steel Yoke Plate */}
        <mesh position={[0, -0.036, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.014, 32]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.92} />
        </mesh>
      </group>

      {/* LAYER 4: Suspensi / Spider & Basket Frame */}
      <group
        ref={(el) => {
          layerRefs.current[3] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'spk-4-spider')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('spk-4-spider');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Corrugated Amber Spider Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.125, 0.018, 12, 36]} />
          <meshStandardMaterial
            color="#d97706"
            roughness={0.85}
            metalness={0.05}
            emissive={getEmissive('spk-4-spider')}
            emissiveIntensity={getEmissiveIntensity('spk-4-spider')}
          />
        </mesh>
        {/* Stamped Steel Basket Outer Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
          <torusGeometry args={[0.28, 0.016, 10, 40]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* 4 Basket Struts */}
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((ang, i) => (
          <mesh
            key={i}
            position={[Math.cos(ang) * 0.2, -0.01, Math.sin(ang) * 0.2]}
            rotation={[0, -ang, 0.25]}
          >
            <boxGeometry args={[0.16, 0.012, 0.024]} />
            <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* LAYER 5: Diafragma / Cone (Moves back-and-forth emitting sound!) */}
      <group
        ref={(el) => {
          layerRefs.current[4] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'spk-5-cone')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('spk-5-cone');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <group ref={coneGroupRef}>
          {/* Acoustic Paper/Poly Cone */}
          <mesh>
            <cylinderGeometry args={[0.078, 0.275, 0.085, 36, 1, true]} />
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.78}
              metalness={0.1}
              side={THREE.DoubleSide}
              emissive={getEmissive('spk-5-cone')}
              emissiveIntensity={getEmissiveIntensity('spk-5-cone')}
            />
          </mesh>
          {/* Rubber Roll Surround */}
          <mesh position={[0, -0.042, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.275, 0.018, 12, 40]} />
            <meshStandardMaterial color="#090d16" roughness={0.85} metalness={0.05} />
          </mesh>
          {/* Center Dust Cap Dome */}
          <mesh position={[0, -0.01, 0]} rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[0.078, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshStandardMaterial color="#0f172a" roughness={0.45} metalness={0.25} />
          </mesh>
        </group>
      </group>

      {/* LAYER 6: Grille Logam */}
      <group
        ref={(el) => {
          layerRefs.current[5] = el;
        }}
        onClick={(e) => handleLayerClick(e, 'spk-6-grille')}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredLayer('spk-6-grille');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredLayer(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Architectural Outer Ceiling Flange Bezel */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.33, 0.025, 14, 48]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.28} metalness={0.65} />
        </mesh>
        {/* Perforated Metal Grille Disc */}
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.012, 40]} />
          <meshStandardMaterial
            map={textures.grille}
            color="#cbd5e1"
            roughness={0.32}
            metalness={0.78}
            emissive={getEmissive('spk-6-grille')}
            emissiveIntensity={getEmissiveIntensity('spk-6-grille')}
          />
        </mesh>
      </group>

      {/* Floating Tooltip for Selected Speaker Layer in Exploded View */}
      {isExploded && activeLayerObj && (
        <Html
          position={[
            0.42,
            offsets.find((o) => o.id === activeLayerObj.id)?.exploded ?? -0.5,
            0,
          ]}
          center
          distanceFactor={3.4}
        >
          <div className="pointer-events-none w-56 rounded-lg border border-sky-400/50 bg-slate-950/95 p-2.5 shadow-xl">
            <div className="text-xs font-semibold text-sky-300">{activeLayerObj.shortLabel}</div>
            <div className="mt-1 text-[11px] leading-snug text-slate-300">
              {activeLayerObj.description}
            </div>
          </div>
        </Html>
      )}

      {/* Overview Clickable Badge */}
      {!isExploded && (
        <Html position={[0, -0.26, 0]} center distanceFactor={10}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectComponent();
            }}
            className="cursor-pointer rounded-md border border-sky-400/40 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-sky-200 transition-colors hover:border-sky-300 hover:bg-slate-900 whitespace-nowrap shadow-md"
          >
            Speaker Plafon 100V ({controls.powerTap}W)
          </button>
        </Html>
      )}
    </group>
  );
}

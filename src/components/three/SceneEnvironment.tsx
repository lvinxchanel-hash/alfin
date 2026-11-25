import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Html } from '@react-three/drei';
import {
  createBrushedMetalTexture,
  createFloorGridTexture,
} from '../../utils/textures';
import { AudioControlsState, FocusTarget, TelemetryState } from '../../types/paSystem';

interface SceneEnvironmentProps {
  focusTarget: FocusTarget;
  controls: AudioControlsState;
  telemetryRef: React.MutableRefObject<TelemetryState>;
  isSoftwareGl: boolean;
}

const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _color = new THREE.Color();

export function SceneEnvironment({
  focusTarget,
  controls,
  telemetryRef,
  isSoftwareGl,
}: SceneEnvironmentProps) {
  const { scene, gl } = useThree();

  // Setup RoomEnvironment PMREM for realistic metallic & glass reflections
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    return () => {
      envRT.dispose();
    };
  }, [gl, scene]);

  // Procedural textures
  const textures = useMemo(() => {
    const opFloor = createFloorGridTexture('#0b111d', '#162235', '#0e7490', 6, 6);
    const aulaFloor = createFloorGridTexture('#0d1522', '#1b2b42', '#1d4ed8', 7, 7);
    const brushedMetal = createBrushedMetalTexture('#202938');
    return { opFloor, aulaFloor, brushedMetal };
  }, []);

  useEffect(() => {
    return () => {
      textures.opFloor.dispose();
      textures.aulaFloor.dispose();
      textures.brushedMetal.dispose();
    };
  }, [textures]);

  // 3D Cable Curves
  const { micCurve, line100VCurve, micTubeGeo, line100VTubeGeo } = useMemo(() => {
    // 1. Kabel Sinyal Lemah (mV): Mic base -> desk grommet -> Rack Mixer input
    const c1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.85, 0.84, 0.45),
      new THREE.Vector3(-3.2, 0.81, 0.12),
      new THREE.Vector3(-3.65, 0.72, -0.32),
      new THREE.Vector3(-4.05, 0.78, -0.82),
      new THREE.Vector3(-4.35, 1.03, -1.06),
    ]);

    // 2. Kabel 100V Line: Rack Mixer output -> wall riser -> glass pass-through -> ceiling plenum -> Speaker Trafo
    const c2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.52, 1.06, -1.38),
      new THREE.Vector3(-4.55, 1.55, -1.85),
      new THREE.Vector3(-3.1, 2.35, -1.92),
      new THREE.Vector3(-0.3, 2.58, -1.55),
      new THREE.Vector3(1.15, 3.68, -0.95),
      new THREE.Vector3(2.2, 3.74, -0.35),
      new THREE.Vector3(2.8, 3.68, 0.0),
    ]);

    return {
      micCurve: c1,
      line100VCurve: c2,
      micTubeGeo: new THREE.TubeGeometry(c1, 64, 0.022, 10, false),
      line100VTubeGeo: new THREE.TubeGeometry(c2, 96, 0.028, 10, false),
    };
  }, []);

  useEffect(() => {
    return () => {
      micTubeGeo.dispose();
      line100VTubeGeo.dispose();
    };
  }, [micTubeGeo, line100VTubeGeo]);

  // Cable glowing signal particles (InstancedMesh)
  const micParticlesRef = useRef<THREE.InstancedMesh>(null);
  const lineParticlesRef = useRef<THREE.InstancedMesh>(null);
  const MIC_PARTICLE_COUNT = 16;
  const LINE_PARTICLE_COUNT = 28;
  const particlePhaseRef = useRef({ mic: 0, line: 0 });

  // Acoustic 3D wavefront rings radiating from Ceiling Speaker
  const waveRingsRef = useRef<(THREE.Mesh | null)[]>([]);
  const micWaveRingsRef = useRef<(THREE.Mesh | null)[]>([]);
  const floorSplRingsRef = useRef<(THREE.Mesh | null)[]>([]);
  const sensorRingMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const tel = telemetryRef.current;

    const micActive = controls.isPaging || tel.micSignalLevel > 0.03;
    const lineActive = tel.speakerSignalLevel > 0.02 || controls.isPaging || controls.isBgmPlaying;

    // Advance particle phases
    const micSpeed = micActive ? 0.45 + tel.micSignalLevel * 0.85 : 0.0;
    const lineSpeed = lineActive ? 0.35 + tel.speakerSignalLevel * 0.95 + (controls.isOverload ? 0.6 : 0) : 0.0;

    particlePhaseRef.current.mic = (particlePhaseRef.current.mic + dt * micSpeed) % 1;
    particlePhaseRef.current.line = (particlePhaseRef.current.line + dt * lineSpeed) % 1;

    // Update Mic mV Cable Particles
    if (micParticlesRef.current) {
      const mesh = micParticlesRef.current;
      for (let i = 0; i < MIC_PARTICLE_COUNT; i++) {
        const u = (i / MIC_PARTICLE_COUNT + particlePhaseRef.current.mic) % 1;
        micCurve.getPointAt(u, _pos);
        const s = micActive ? 0.85 + tel.micSignalLevel * 0.75 : 0.001;
        _scale.set(s, s, s);
        _mat.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = micActive;
    }

    // Update 100V Line Cable Particles
    if (lineParticlesRef.current) {
      const mesh = lineParticlesRef.current;
      for (let i = 0; i < LINE_PARTICLE_COUNT; i++) {
        const u = (i / LINE_PARTICLE_COUNT + particlePhaseRef.current.line) % 1;
        line100VCurve.getPointAt(u, _pos);
        const s = lineActive ? 0.85 + tel.speakerSignalLevel * 0.9 : 0.001;
        _scale.set(s, s, s);
        _mat.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = lineActive;

      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (controls.isOverload || tel.overloadAlarm) {
        _color.set('#ef4444');
      } else if (controls.isPaging) {
        _color.set('#f59e0b');
      } else {
        _color.set('#34d399');
      }
      mat.color.lerp(_color, 0.2);
    }

    // Animate 3D Acoustic Wavefronts descending from Ceiling Speaker into Ruang Aula
    const waveIntensity = Math.min(1, Math.max(0, (tel.dbSpl - 38) / 72));
    const time = performance.now() * 0.001;
    waveRingsRef.current.forEach((ring, idx) => {
      if (!ring) return;
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (!lineActive || waveIntensity < 0.04) {
        ring.visible = false;
        return;
      }
      ring.visible = true;
      const cycle = (time * 0.85 + idx * 0.25) % 1;
      const y = 3.38 - cycle * 2.55;
      const radiusScale = 0.25 + cycle * (1.35 + (controls.powerTap / 10) * 0.55);
      ring.position.set(2.8, y, 0.0);
      ring.scale.set(radiusScale, radiusScale, 1);
      mat.opacity = (1 - cycle) * (0.28 + waveIntensity * 0.45);
      if (tel.dbStatus === 'danger') {
        mat.color.set('#ef4444');
      } else if (tel.dbStatus === 'warning') {
        mat.color.set('#f59e0b');
      } else {
        mat.color.set('#22d3ee');
      }
    });

    // Animate Mic Vocal Waves near Paging Mic Grille
    micWaveRingsRef.current.forEach((ring, idx) => {
      if (!ring) return;
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (!controls.isPaging) {
        ring.visible = false;
        return;
      }
      ring.visible = true;
      const cycle = (time * 1.4 + idx * 0.33) % 1;
      const s = 0.4 + cycle * 1.3;
      ring.position.set(-2.76 + cycle * 0.18, 1.36 + cycle * 0.05, 0.48 + cycle * 0.08);
      ring.scale.set(s, s, s);
      mat.opacity = (1 - cycle) * 0.5;
    });

    // Animate Floor Sound Dispersion Rings around Sensor Suara Pole
    floorSplRingsRef.current.forEach((ring, idx) => {
      if (!ring) return;
      const mat = ring.material as THREE.MeshBasicMaterial;
      const cycle = (time * (0.45 + waveIntensity * 0.7) + idx * 0.33) % 1;
      const maxSpread = 0.7 + waveIntensity * 1.85;
      const s = 0.3 + cycle * maxSpread;
      ring.scale.set(s, s, 1);
      mat.opacity = (0.12 + waveIntensity * 0.48) * (1 - cycle);

      if (tel.dbStatus === 'danger') {
        mat.color.set('#ef4444');
      } else if (tel.dbStatus === 'warning') {
        mat.color.set('#f59e0b');
      } else {
        mat.color.set('#10b981');
      }
    });

    // Update Sensor Pole Status Ring Color
    if (sensorRingMatRef.current) {
      if (tel.dbStatus === 'danger' || tel.overloadAlarm) {
        _color.set('#ef4444');
      } else if (tel.dbStatus === 'warning' || tel.thermalAlarm) {
        _color.set('#f59e0b');
      } else {
        _color.set('#10b981');
      }
      sensorRingMatRef.current.color.lerp(_color, 0.15);
      sensorRingMatRef.current.emissive.lerp(_color, 0.15);
    }
  });

  const showLabels = focusTarget === 'overview';

  return (
    <group>
      {/* Horizon Fog & Atmospheric Lighting */}
      <color attach="background" args={['#070b12']} />
      <fogExp2 attach="fog" args={['#070b12', 0.032]} />

      {/* Warm Key Light + Cool Hemisphere Fill + Rim Light */}
      <hemisphereLight args={['#93c5fd', '#0f172a', 0.65]} />
      <directionalLight
        position={[5.5, 8.5, 6.5]}
        intensity={1.55}
        color="#fff4e6"
        castShadow={!isSoftwareGl}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={24}
      />
      <directionalLight position={[-6, 4.5, -4]} intensity={0.65} color="#38bdf8" />
      <pointLight position={[-3.2, 3.1, 0.2]} intensity={1.2} distance={8} color="#e0f2fe" />
      <pointLight position={[2.8, 3.2, 0.2]} intensity={1.4} distance={9} color="#f8fafc" />

      {/* Ground Base Plane (infinite dark studio horizon) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#05080f" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* ==================== RUANG OPERATOR (KIRI, x < -0.3) ==================== */}
      <group>
        {/* Operator Floor */}
        <mesh position={[-3.05, 0.0, 0]} receiveShadow>
          <boxGeometry args={[5.5, 0.04, 6.0]} />
          <meshStandardMaterial
            map={textures.opFloor}
            roughness={0.7}
            metalness={0.18}
          />
        </mesh>

        {/* Back Wall (Ruang Operator) */}
        <mesh position={[-3.05, 1.9, -2.98]} receiveShadow>
          <boxGeometry args={[5.5, 3.8, 0.08]} />
          <meshStandardMaterial color="#0f172a" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Left Side Wall */}
        <mesh position={[-5.78, 1.9, 0]} receiveShadow>
          <boxGeometry args={[0.08, 3.8, 6.0]} />
          <meshStandardMaterial color="#0d1424" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Acoustic Diffuser Slats on Operator Back Wall */}
        {[-5.0, -4.4, -3.8, -3.2, -2.6, -2.0, -1.4, -0.8].map((xPos, i) => (
          <mesh key={i} position={[xPos, 1.9, -2.91]}>
            <boxGeometry args={[0.14, 3.2, 0.06]} />
            <meshStandardMaterial color="#1e293b" roughness={0.65} metalness={0.2} />
          </mesh>
        ))}

        {/* Operator Console Desk */}
        <group position={[-2.95, 0, 0.45]}>
          {/* Desktop Surface */}
          <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 0.06, 0.95]} />
            <meshStandardMaterial color="#1e293b" roughness={0.42} metalness={0.25} />
          </mesh>
          {/* Desk Accent Front Trim */}
          <mesh position={[0, 0.78, 0.48]}>
            <boxGeometry args={[2.0, 0.025, 0.02]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.6} roughness={0.3} />
          </mesh>
          {/* Desk Mat */}
          <mesh position={[0.1, 0.812, 0.05]} receiveShadow>
            <boxGeometry args={[1.15, 0.008, 0.56]} />
            <meshStandardMaterial color="#090d16" roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Steel Desk Legs */}
          {[
            [-0.88, 0.38, -0.36],
            [0.88, 0.38, -0.36],
            [-0.88, 0.38, 0.36],
            [0.88, 0.38, 0.36],
          ].map((pos, idx) => (
            <mesh key={idx} position={pos as [number, number, number]} castShadow>
              <boxGeometry args={[0.06, 0.76, 0.06]} />
              <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.8} />
            </mesh>
          ))}
          {/* Operator Control Monitor */}
          <group position={[-0.55, 0.81, -0.2]} rotation={[0, 0.32, 0]}>
            <mesh position={[0, 0.015, 0]}>
              <cylinderGeometry args={[0.12, 0.14, 0.03, 24]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.16, -0.02]}>
              <boxGeometry args={[0.04, 0.28, 0.04]} />
              <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.3, 0.01]} castShadow>
              <boxGeometry args={[0.68, 0.38, 0.03]} />
              <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.3, 0.027]}>
              <planeGeometry args={[0.62, 0.32]} />
              <meshStandardMaterial
                color="#082f49"
                emissive="#0ea5e9"
                emissiveIntensity={0.45}
                roughness={0.2}
              />
            </mesh>
          </group>
        </group>

        {/* Rak Audio 19-Inch Cabinet */}
        <group position={[-4.4, 0, -1.25]} rotation={[0, 0.35, 0]}>
          {/* Rack Chassis Base & Sides */}
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, 0.08, 0.68]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.75} />
          </mesh>
          {/* Left & Right Rack Pillars */}
          <mesh position={[-0.36, 0.84, 0]} castShadow>
            <boxGeometry args={[0.06, 1.54, 0.64]} />
            <meshStandardMaterial map={textures.brushedMetal} color="#1e293b" roughness={0.4} metalness={0.8} />
          </mesh>
          <mesh position={[0.36, 0.84, 0]} castShadow>
            <boxGeometry args={[0.06, 1.54, 0.64]} />
            <meshStandardMaterial map={textures.brushedMetal} color="#1e293b" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Rack Back & Top */}
          <mesh position={[0, 0.84, -0.3]} castShadow>
            <boxGeometry args={[0.74, 1.54, 0.04]} />
            <meshStandardMaterial color="#0b1120" roughness={0.6} metalness={0.65} />
          </mesh>
          <mesh position={[0, 1.62, 0]} castShadow>
            <boxGeometry args={[0.78, 0.05, 0.68]} />
            <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.75} />
          </mesh>
          {/* Lower Power Conditioner Unit */}
          <mesh position={[0, 0.42, 0.02]}>
            <boxGeometry args={[0.64, 0.18, 0.54]} />
            <meshStandardMaterial color="#111827" roughness={0.45} metalness={0.7} />
          </mesh>
          {/* Lower Vent Panel */}
          <mesh position={[0, 0.66, 0.02]}>
            <boxGeometry args={[0.64, 0.22, 0.52]} />
            <meshStandardMaterial color="#090d16" roughness={0.7} metalness={0.5} />
          </mesh>
          {/* Upper Blank / Patch Bay */}
          <mesh position={[0, 1.42, 0.02]}>
            <boxGeometry args={[0.64, 0.18, 0.54]} />
            <meshStandardMaterial color="#151e2e" roughness={0.5} metalness={0.7} />
          </mesh>
          {/* Rack Power Status LED */}
          <mesh position={[0.24, 0.43, 0.295]}>
            <boxGeometry args={[0.04, 0.018, 0.01]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.6} />
          </mesh>
        </group>

        {showLabels && (
          <Html position={[-3.2, 2.75, -2.2]} center distanceFactor={10}>
            <div className="pointer-events-none select-none rounded-md border border-cyan-500/30 bg-slate-950/90 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200 whitespace-nowrap shadow-lg">
              Ruang Operator (Kontrol PA)
            </div>
          </Html>
        )}
      </group>

      {/* ==================== DINDING KACA TRANSPARAN (x = -0.3) ==================== */}
      <group position={[-0.3, 0, 0]}>
        {/* Bottom & Top Aluminum Channels */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.1, 0.12, 6.0]} />
          <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.85} />
        </mesh>
        <mesh position={[0, 3.62, 0]}>
          <boxGeometry args={[0.12, 0.14, 6.0]} />
          <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.85} />
        </mesh>
        {/* Vertical Mullion Posts */}
        {[-2.94, -1.0, 1.0, 2.94].map((zPos, i) => (
          <mesh key={i} position={[0, 1.84, zPos]}>
            <boxGeometry args={[0.09, 3.55, 0.08]} />
            <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.85} />
          </mesh>
        ))}
        {/* Transparent Acoustic Glass Pane */}
        <mesh position={[0, 1.84, 0]} renderOrder={2}>
          <boxGeometry args={[0.025, 3.45, 5.88]} />
          {isSoftwareGl ? (
            <meshStandardMaterial
              color="#7dd3fc"
              transparent
              opacity={0.18}
              roughness={0.1}
              metalness={0.2}
              depthWrite={false}
            />
          ) : (
            <meshPhysicalMaterial
              color="#bae6fd"
              transparent
              opacity={0.22}
              roughness={0.06}
              metalness={0.05}
              ior={1.52}
              reflectivity={0.9}
              clearcoat={1}
              depthWrite={false}
            />
          )}
        </mesh>

        {/* Cable Conduit Grommet passing 100V Line through glass wall */}
        <mesh position={[0, 2.58, -1.55]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.09, 0.16, 20]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.35} metalness={0.8} />
        </mesh>
      </group>

      {/* ==================== RUANG AULA (KANAN, x > -0.3) ==================== */}
      <group>
        {/* Aula Floor (slightly offset Y=0.01 to avoid Z-fighting) */}
        <mesh position={[2.75, 0.01, 0]} receiveShadow>
          <boxGeometry args={[6.0, 0.04, 6.0]} />
          <meshStandardMaterial
            map={textures.aulaFloor}
            roughness={0.78}
            metalness={0.12}
          />
        </mesh>

        {/* Back Wall (Ruang Aula) */}
        <mesh position={[2.75, 1.9, -2.98]} receiveShadow>
          <boxGeometry args={[6.0, 3.8, 0.08]} />
          <meshStandardMaterial color="#111827" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Right Side Wall */}
        <mesh position={[5.76, 1.9, 0]} receiveShadow>
          <boxGeometry args={[0.08, 3.8, 6.0]} />
          <meshStandardMaterial color="#0e1626" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Aula Acoustic Wall Panels */}
        {[0.7, 2.1, 3.5, 4.9].map((xPos, idx) => (
          <mesh key={idx} position={[xPos, 1.85, -2.92]}>
            <boxGeometry args={[0.95, 2.2, 0.04]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.05} />
          </mesh>
        ))}

        {/* Plafon / Ceiling Deck (Cutaway Architectural Ceiling over Aula) */}
        <group position={[2.8, 3.58, 0]}>
          {/* Main Ceiling Frame Panels leaving speaker aperture clear */}
          <mesh position={[-1.4, 0, 0]} receiveShadow>
            <boxGeometry args={[2.1, 0.1, 4.6]} />
            <meshStandardMaterial color="#162032" roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[1.4, 0, 0]} receiveShadow>
            <boxGeometry args={[2.1, 0.1, 4.6]} />
            <meshStandardMaterial color="#162032" roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, -1.45]} receiveShadow>
            <boxGeometry args={[0.7, 0.1, 1.7]} />
            <meshStandardMaterial color="#162032" roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 1.45]} receiveShadow>
            <boxGeometry args={[0.7, 0.1, 1.7]} />
            <meshStandardMaterial color="#162032" roughness={0.7} metalness={0.2} />
          </mesh>
          {/* Recessed Architectural Ceiling Light Strips */}
          <mesh position={[-1.7, -0.055, 0]}>
            <boxGeometry args={[0.06, 0.015, 3.8]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={1.1} />
          </mesh>
          <mesh position={[1.7, -0.055, 0]}>
            <boxGeometry args={[0.06, 0.015, 3.8]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={1.1} />
          </mesh>
        </group>

        {/* Tiang Sensor Suara (Acoustic Measurement Pole in center of Aula) */}
        <group position={[2.8, 0.03, 0.72]}>
          {/* Heavy Tripod / Circular Calibration Base */}
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.3, 0.06, 32]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Stainless Steel Vertical Pole */}
          <mesh position={[0, 0.82, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.032, 1.56, 20]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.9} />
          </mesh>
          {/* Telemetry Status Ring Collar */}
          <mesh position={[0, 1.32, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.07, 24]} />
            <meshStandardMaterial
              ref={sensorRingMatRef}
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={1.4}
              roughness={0.25}
            />
          </mesh>
          {/* Measurement Condenser Capsule Tip */}
          <mesh position={[0, 1.66, 0]} castShadow>
            <cylinderGeometry args={[0.014, 0.022, 0.16, 16]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.92} />
          </mesh>
          <mesh position={[0, 1.75, 0]}>
            <sphereGeometry args={[0.016, 16, 16]} />
            <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.6} />
          </mesh>

          {showLabels && (
            <Html position={[0, 1.98, 0]} center distanceFactor={10}>
              <div className="pointer-events-none select-none rounded-md border border-emerald-500/35 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-emerald-200 whitespace-nowrap shadow-lg">
                Tiang Sensor Suara (dB SPL)
              </div>
            </Html>
          )}
        </group>

        {/* Floor Sound Dispersion Rings (Visualisasi Penyebaran Suara) */}
        <group position={[2.8, 0.04, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
          {[0, 1, 2].map((idx) => (
            <mesh
              key={idx}
              ref={(el) => {
                floorSplRingsRef.current[idx] = el;
              }}
            >
              <ringGeometry args={[0.88, 0.96, 64]} />
              <meshBasicMaterial
                color="#10b981"
                transparent
                opacity={0.25}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>

        {showLabels && (
          <Html position={[2.8, 2.75, -2.2]} center distanceFactor={10}>
            <div className="pointer-events-none select-none rounded-md border border-indigo-400/30 bg-slate-950/90 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200 whitespace-nowrap shadow-lg">
              Ruang Aula (Zona Pendengar)
            </div>
          </Html>
        )}
      </group>

      {/* ==================== KABEL 3D & PARTIKEL BERCAHAYA ==================== */}
      <group>
        {/* Kabel 1: Sinyal Lemah (mV) */}
        <mesh geometry={micTubeGeo}>
          <meshStandardMaterial color="#0e7490" roughness={0.45} metalness={0.3} />
        </mesh>

        {/* Kabel 2: Jalur 100V Line */}
        <mesh geometry={line100VTubeGeo}>
          <meshStandardMaterial
            color={controls.isOverload ? '#991b1b' : '#b45309'}
            roughness={0.4}
            metalness={0.35}
          />
        </mesh>

        {/* Partikel Bercahaya Kabel Mic (mV) */}
        <instancedMesh
          ref={micParticlesRef}
          args={[undefined, undefined, MIC_PARTICLE_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshBasicMaterial color="#22d3ee" />
        </instancedMesh>

        {/* Partikel Bercahaya Kabel 100V Line */}
        <instancedMesh
          ref={lineParticlesRef}
          args={[undefined, undefined, LINE_PARTICLE_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.048, 12, 12]} />
          <meshBasicMaterial color="#34d399" />
        </instancedMesh>
      </group>

      {/* ==================== GELOMBANG AKUSTIK 3D DI UDARA ==================== */}
      {/* Speaker Acoustic Wavefronts descending in Aula */}
      {[0, 1, 2, 3].map((idx) => (
        <mesh
          key={`spk-wave-${idx}`}
          ref={(el) => {
            waveRingsRef.current[idx] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <torusGeometry args={[0.8, 0.018, 12, 48]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}

      {/* Mic Vocal Wavefronts in Operator Room */}
      {[0, 1, 2].map((idx) => (
        <mesh
          key={`mic-wave-${idx}`}
          ref={(el) => {
            micWaveRingsRef.current[idx] = el;
          }}
          rotation={[0, -0.4, 0]}
          visible={false}
        >
          <torusGeometry args={[0.14, 0.008, 8, 32, Math.PI * 0.9]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

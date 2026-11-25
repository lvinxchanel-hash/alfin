import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { CAMERA_PRESETS } from '../../data/componentsData';
import { FocusTarget } from '../../types/paSystem';

interface CameraRigProps {
  focusTarget: FocusTarget;
  isSoftwareGl: boolean;
}

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();

export function CameraRig({ focusTarget, isSoftwareGl }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const transitioningRef = useRef(true);

  useEffect(() => {
    transitioningRef.current = true;
  }, [focusTarget]);

  useFrame((_, delta) => {
    if (!transitioningRef.current || !controlsRef.current) return;

    const dt = Math.min(delta, 0.05);
    const preset = CAMERA_PRESETS[focusTarget];
    _desiredPos.set(...preset.position);
    _desiredLook.set(...preset.lookAt);

    const lambda = 4.8;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, lambda, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, lambda, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, lambda, dt);

    controlsRef.current.target.x = THREE.MathUtils.damp(
      controlsRef.current.target.x,
      _desiredLook.x,
      lambda,
      dt
    );
    controlsRef.current.target.y = THREE.MathUtils.damp(
      controlsRef.current.target.y,
      _desiredLook.y,
      lambda,
      dt
    );
    controlsRef.current.target.z = THREE.MathUtils.damp(
      controlsRef.current.target.z,
      _desiredLook.z,
      lambda,
      dt
    );

    controlsRef.current.update();

    if (
      camera.position.distanceTo(_desiredPos) < 0.015 &&
      controlsRef.current.target.distanceTo(_desiredLook) < 0.015
    ) {
      transitioningRef.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!isSoftwareGl}
      dampingFactor={0.07}
      minDistance={0.65}
      maxDistance={13.5}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => {
        transitioningRef.current = false;
      }}
    />
  );
}

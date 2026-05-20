import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

function ParticleField({ scroll }: { scroll: number }) {
  const ref = useRef<THREE.Points>(null);
  const count = 1200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 28;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.04 + scroll * 0.8;
    ref.current.rotation.x = scroll * 0.25;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#67e8f9" transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}

function CoreShape({ scroll }: { scroll: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.x = state.clock.elapsedTime * 0.35 + scroll;
    mesh.current.rotation.y = state.clock.elapsedTime * 0.5 + scroll * 1.2;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshStandardMaterial
          color="#22d3ee"
          wireframe
          emissive="#0891b2"
          emissiveIntensity={0.35}
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>
    </Float>
  );
}

function SceneContent({ scroll }: { scroll: number }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 8]} intensity={1.1} color="#a5f3fc" />
      <directionalLight position={[-6, -2, -4]} intensity={0.45} color="#c4b5fd" />
      <Stars radius={80} depth={40} count={2500} factor={3} fade speed={0.6} />
      <ParticleField scroll={scroll} />
      <CoreShape scroll={scroll} />
    </>
  );
}

export function LandingScene({ scroll }: { scroll: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 52 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <SceneContent scroll={scroll} />
      </Canvas>
    </div>
  );
}

'use client';

import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AccumulativeShadows, Environment, OrbitControls, RandomizedLight, Sky, StatsGl } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, ToneMapping, SMAA, SSAO } from '@react-three/postprocessing';

export type LightingPreset = 'daylight' | 'golden' | 'overcast';

export type RenderOptions = {
  width: number;
  height: number;
  samples?: number;
};

export type FacadeCanvasHandle = {
  renderHighRes: (opts: RenderOptions) => Promise<string>;
  randomize: () => void;
  setPreset: (p: LightingPreset) => void;
};

function useFacadeState() {
  const [columns, setColumns] = useState(10);
  const [rows, setRows] = useState(6);
  const [seed, setSeed] = useState(1);
  const [preset, setPreset] = useState<LightingPreset>('daylight');
  const randomize = () => setSeed((s) => (s + 1) % 10000);
  return { columns, rows, seed, preset, setPreset, randomize };
}

function seededRandom(seed: number) {
  let t = seed + 0x6D2B79F5;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function Facade() {
  const { viewport } = useThree();
  const { columns, rows, seed } = useFacadeStateContext();
  const group = useRef<THREE.Group>(null);

  const rand = useMemo(() => seededRandom(seed), [seed]);

  const moduleWidth = 1.2;
  const moduleHeight = 1.0;
  const frameDepth = 0.25;
  const frameThickness = 0.08;
  const gap = 0.06;

  const totalWidth = columns * (moduleWidth + gap) - gap;
  const totalHeight = rows * (moduleHeight + gap) - gap;

  // Materials
  const concrete = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b7b9bc'),
    roughness: 0.9,
    metalness: 0.0,
    clearcoat: 0.05,
  }), []);

  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#87a4b3').multiplyScalar(0.9),
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.94,
    thickness: 0.4,
    transparent: true,
    ior: 1.52,
    reflectivity: 1.0,
    envMapIntensity: 1.2,
  }), []);

  const wood = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b07a52'),
    roughness: 0.6,
    metalness: 0.05,
  }), []);

  // Geometries reused
  const frameGeo = useMemo(() => new THREE.BoxGeometry(moduleWidth, moduleHeight, frameDepth), []);
  const glassGeo = useMemo(() => new THREE.PlaneGeometry(moduleWidth - frameThickness * 2, moduleHeight - frameThickness * 2), []);
  const slatGeo = useMemo(() => new THREE.BoxGeometry(moduleWidth - frameThickness * 2, 0.025, 0.03), []);

  const frames = [] as JSX.Element[];
  const panels = [] as JSX.Element[];
  const louvers = [] as JSX.Element[];

  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * (moduleWidth + gap) - totalWidth / 2 + moduleWidth / 2;
      const y = j * (moduleHeight + gap) - totalHeight / 2 + moduleHeight / 2;

      // Concrete frame as hollow frame using 4 skinny boxes to keep the opening
      const segments = [
        { w: moduleWidth, h: frameThickness, z: 0, ox: 0, oy: +(moduleHeight - frameThickness) / 2 },
        { w: moduleWidth, h: frameThickness, z: 0, ox: 0, oy: -(moduleHeight - frameThickness) / 2 },
        { w: frameThickness, h: moduleHeight - frameThickness * 2, z: 0, ox: +(moduleWidth - frameThickness) / 2, oy: 0 },
        { w: frameThickness, h: moduleHeight - frameThickness * 2, z: 0, ox: -(moduleWidth - frameThickness) / 2, oy: 0 },
      ];
      segments.forEach((s, idx) => {
        frames.push(
          <mesh key={`f-${i}-${j}-${idx}`} position={[x + s.ox, y + s.oy, s.z]} material={concrete}>
            <boxGeometry args={[s.w, s.h, frameDepth]} />
          </mesh>
        );
      });

      // Glass panel slightly recessed
      panels.push(
        <mesh key={`g-${i}-${j}`} position={[x, y, -0.02]} material={glass}>
          <planeGeometry args={[moduleWidth - frameThickness * 2, moduleHeight - frameThickness * 2]} />
        </mesh>
      );

      // Wooden louvers: choose density and angle per cell for rhythm
      const density = 6 + Math.floor(rand() * 6); // 6..11 slats
      const tilt = THREE.MathUtils.lerp(0.1, 0.6, rand()); // slight tilt
      const openChance = rand();
      const open = openChance > 0.7; // some modules open (no louvers)

      if (!open) {
        for (let s = 0; s < density; s++) {
          const ty = THREE.MathUtils.lerp(
            - (moduleHeight - frameThickness * 2) / 2 + 0.05,
            + (moduleHeight - frameThickness * 2) / 2 - 0.05,
            s / (density - 1)
          );
          louvers.push(
            <mesh key={`w-${i}-${j}-${s}`} position={[x, y + ty, 0.07]} material={wood}>
              {/* rotate around X for tilt */}
              <boxGeometry args={[moduleWidth - frameThickness * 2, 0.025, 0.03]} />
              <group rotation={[tilt, 0, 0]} />
            </mesh>
          );
        }
      }
    }
  }

  return (
    <group ref={group}>
      {frames}
      {panels}
      {louvers}
    </group>
  );
}

// Context to share state between canvas internals and UI
const FacadeStateContext = React.createContext<ReturnType<typeof useFacadeState> | null>(null);
function useFacadeStateContext() {
  const ctx = React.useContext(FacadeStateContext);
  if (!ctx) throw new Error('FacadeStateContext missing');
  return ctx;
}

function Lighting({ preset }: { preset: LightingPreset }) {
  const sunPos = {
    daylight: new THREE.Vector3(5, 8, 6),
    golden: new THREE.Vector3(-4, 6, 3),
    overcast: new THREE.Vector3(2, 4, 2)
  }[preset];

  const skyProps = {
    daylight: { turbidity: 3, rayleigh: 2, mieCoefficient: 0.004, mieDirectionalG: 0.9, elevation: 55, azimuth: 140 },
    golden: { turbidity: 4, rayleigh: 1.6, mieCoefficient: 0.006, mieDirectionalG: 0.92, elevation: 15, azimuth: 210 },
    overcast: { turbidity: 8, rayleigh: 1.2, mieCoefficient: 0.02, mieDirectionalG: 0.8, elevation: 60, azimuth: 180 },
  } as const;

  return (
    <>
      <Sky {...(skyProps as any)[preset]} />
      <directionalLight position={sunPos.toArray()} intensity={preset === 'overcast' ? 1.2 : 2.5} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10, 1, 50]} />
      </directionalLight>
      <ambientLight intensity={preset === 'overcast' ? 0.6 : 0.3} />
      <Environment preset={preset === 'golden' ? 'sunset' : 'city'} />
    </>
  );
}

function Ground() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8dadc'), roughness: 1.0 }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial attach="material" color="#d8dadc" roughness={1} />
    </mesh>
  );
}

function SceneInner() {
  const state = useFacadeStateContext();
  const { camera, gl, scene, size } = useThree();

  useFrame(() => {
    // Ensure ACES tonemapping every frame
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, 1);

  return (
    <>
      <Lighting preset={state.preset} />
      <group position={[0, 0, 0]}>
        <Facade />
      </group>
      <Ground />
      <AccumulativeShadows temporal frames={60} alphaTest={0.8} scale={20} position={[0, -0.01, 0]}>
        <RandomizedLight amount={8} radius={4} ambient={0.2} intensity={0.3} position={[5, 8, -3]} />
      </AccumulativeShadows>
      <EffectComposer multisampling={0}>
        <SMAA />
        {/** SSAO omitted for build stability */}
        <Bloom intensity={0.3} luminanceThreshold={0.9} luminanceSmoothing={0.1} mipmapBlur />
        <ToneMapping adaptive={false} mode={THREE.ACESFilmicToneMapping as any} />
      </EffectComposer>
      <OrbitControls makeDefault target={[0, 0, 0]} maxDistance={25} minDistance={5} />
      {/* <StatsGl /> */}
    </>
  );
}

function HighResRendererHandle({ resolve }: { resolve: (url: string) => void }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<any>(null);
  // We rely on the primary composer present above; we will render the default renderer
  useFrame(() => {}, 0);
  return null;
}

const FacadeCanvasInner = forwardRef<FacadeCanvasHandle, {}>(function FacadeCanvasInner(_props, ref) {
  const state = useFacadeState();
  const { preset } = state;
  const three = useThree();
  const { gl, scene, camera } = three;

  const renderHighRes = async ({ width, height }: RenderOptions) => {
    const prevSize = { width: three.size.width, height: three.size.height };
    const prevPixelRatio = gl.getPixelRatio();
    // Use pixel ratio 1 to reduce VRAM at 8K
    gl.setPixelRatio(1);
    gl.setSize(width, height, false);
    // If using effect composer, ideally call composer.render(); however r3f's internal composer renders on frame
    gl.render(scene, camera);
    const dataURL = gl.domElement.toDataURL('image/png');
    // Revert size
    gl.setSize(prevSize.width, prevSize.height, false);
    gl.setPixelRatio(prevPixelRatio);
    return dataURL;
  };

  useImperativeHandle(ref, () => ({
    renderHighRes,
    randomize: state.randomize,
    setPreset: state.setPreset,
  }));

  return (
    <FacadeStateContext.Provider value={state}>
      <SceneInner />
    </FacadeStateContext.Provider>
  );
});

export const FacadeCanvas = forwardRef<FacadeCanvasHandle, {}>(function FacadeCanvas(props, ref) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ position: [6, 4, 10], fov: 45, near: 0.1, far: 100 }}
    >
      <color attach="background" args={[0.05, 0.07, 0.1]} />
      <FacadeCanvasInner ref={ref} />
    </Canvas>
  );
});

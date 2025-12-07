import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, Float, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Color, MathUtils } from 'three';

// --- SHADER FOR FOLIAGE ---
// This allows us to morph 15,000 needles efficiently on the GPU
const foliageVertexShader = `
  uniform float uProgress;
  uniform float uTime;
  attribute vec3 aChaosPos;
  attribute float aSpeed;
  
  varying vec3 vColor;
  
  void main() {
    // Cubic easing for the progress
    float t = uProgress;
    
    // Add some noise based on time and index to make the "explosion" feel alive
    vec3 noise = vec3(
      sin(uTime * aSpeed + position.x),
      cos(uTime * aSpeed + position.y),
      sin(uTime * aSpeed + position.z)
    ) * 0.2 * t;

    vec3 finalPos = mix(position, aChaosPos + noise, t);
    
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (40.0 * (1.0 - t * 0.5)) / -mvPosition.z;
    
    // Darken color slightly in chaos mode
    vColor = color * (1.0 - t * 0.3); 
  }
`;

const foliageFragmentShader = `
  varying vec3 vColor;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    // Add a golden sheen to the center of needles
    vec3 sheen = vec3(1.0, 0.8, 0.2) * (1.0 - smoothstep(0.0, 0.4, r));
    gl_FragColor = vec4(vColor + sheen * 0.2, 1.0);
  }
`;

interface LuxuryTreeProps {
  isUnleashed: boolean;
}

export const LuxuryTree: React.FC<LuxuryTreeProps> = ({ isUnleashed }) => {
  const foliageRef = useRef<THREE.Points>(null);
  const ornamentGroupRef = useRef<THREE.Group>(null);
  
  // Progress state for smooth animation (0 = Formed, 1 = Chaos)
  const progress = useRef(0);

  // --- 1. GENERATE FOLIAGE DATA ---
  const foliageData = useMemo(() => {
    const count = 12000;
    const positions = new Float32Array(count * 3);
    const chaosPositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    
    const emerald = new Color("#003318");
    const darkGreen = new Color("#001a0c");
    const gold = new Color("#FFD700");

    for (let i = 0; i < count; i++) {
      // TARGET: CONE SHAPE
      const h = Math.random() * 9; // Height 0 to 9
      const rBase = 3.5 * (1 - h / 9.5);
      const theta = Math.random() * Math.PI * 2;
      // Add volume to the branches
      const r = rBase * Math.sqrt(Math.random()); 
      
      const x = r * Math.cos(theta);
      const y = h - 4.5; // Center vertically
      const z = r * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // CHAOS: SPHERICAL EXPLOSION
      // Explode outwards, but bias towards the top
      const cx = (Math.random() - 0.5) * 25;
      const cy = (Math.random() - 0.5) * 25 + 5;
      const cz = (Math.random() - 0.5) * 25;
      
      chaosPositions[i * 3] = cx;
      chaosPositions[i * 3 + 1] = cy;
      chaosPositions[i * 3 + 2] = cz;

      // COLOR
      const isGoldTip = Math.random() > 0.9;
      const c = isGoldTip ? gold : (Math.random() > 0.5 ? emerald : darkGreen);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      
      speeds[i] = Math.random();
    }
    
    return { positions, chaosPositions, colors, speeds };
  }, []);

  // --- 2. GENERATE ORNAMENT DATA ---
  // We use InstancedMesh for performance, but calculate positions in JS useFrame for control
  const ornamentData = useMemo(() => {
    const count = 300;
    const items = [];
    for(let i=0; i<count; i++) {
        // Target
        const h = Math.random() * 8.5;
        const r = (3.5 * (1 - h / 9.5)) + 0.2; // Slightly outside foliage
        const theta = Math.random() * Math.PI * 2 * 10; // Spiral
        
        const tx = r * Math.cos(theta);
        const ty = h - 4.5;
        const tz = r * Math.sin(theta);

        // Chaos
        const cx = (Math.random() - 0.5) * 30;
        const cy = (Math.random() - 0.5) * 30;
        const cz = (Math.random() - 0.5) * 30;

        items.push({
            target: new THREE.Vector3(tx, ty, tz),
            chaos: new THREE.Vector3(cx, cy, cz),
            scale: Math.random() * 0.3 + 0.1,
            speed: Math.random() * 0.5 + 0.5, // Parallax effect
            rotSpeed: Math.random() * 2,
            // 90% Cats!
            type: Math.random() > 0.1 ? 'ball' : 'gift'
        });
    }
    return items;
  }, []);

  // --- ANIMATION LOOP ---
  useFrame((state, delta) => {
    // 1. Interpolate global progress
    const target = isUnleashed ? 1 : 0;
    // Lerp smoothly: Chaos is fast (0.5), Reform is slower (2.0) to look elegant
    const speed = isUnleashed ? 2.0 : 1.0; 
    progress.current = MathUtils.damp(progress.current, target, speed, delta);

    // 2. Update Foliage Shader
    if (foliageRef.current) {
        const mat = foliageRef.current.material as THREE.ShaderMaterial;
        mat.uniforms.uProgress.value = progress.current;
        mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {/* --- FOLIAGE SYSTEM (GPU) --- */}
      <points ref={foliageRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={foliageData.positions.length / 3} array={foliageData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aChaosPos" count={foliageData.chaosPositions.length / 3} array={foliageData.chaosPositions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={foliageData.colors.length / 3} array={foliageData.colors} itemSize={3} />
          <bufferAttribute attach="attributes-aSpeed" count={foliageData.speeds.length} array={foliageData.speeds} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial 
          vertexShader={foliageVertexShader}
          fragmentShader={foliageFragmentShader}
          uniforms={{
            uProgress: { value: 0 },
            uTime: { value: 0 }
          }}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* --- ORNAMENT SYSTEM (CPU Interpolated) --- */}
      <group ref={ornamentGroupRef}>
         {ornamentData.map((data, i) => (
             <OrnamentItem key={i} data={data} progress={progress} />
         ))}
      </group>

      {/* --- THE GUARDIANS --- */}
      <GuardianCats progress={progress} />

      {/* --- THE TOPPER (Special) --- */}
      <Topper progress={progress} />
      
    </group>
  );
};

// Helper for individual ornaments to handle their own lerp/physics
const OrnamentItem: React.FC<{ data: any, progress: React.MutableRefObject<number> }> = ({ data, progress }) => {
    const meshRef = useRef<THREE.Group>(null);
    const vec = new THREE.Vector3();

    useFrame((state) => {
        if (!meshRef.current) return;
        
        // Calculate current position based on global progress, but modified by item weight/speed
        // This makes the explosion feel "layered" rather than linear
        const p = progress.current;
        // Ease the progress per item
        const localP = MathUtils.smootherstep(p, 0, 1);
        
        vec.lerpVectors(data.target, data.chaos, localP);
        
        // Add some float
        vec.y += Math.sin(state.clock.elapsedTime * data.speed + data.target.x) * 0.05;

        meshRef.current.position.copy(vec);
        meshRef.current.rotation.x += 0.01 * data.rotSpeed;
        meshRef.current.rotation.y += 0.01 * data.rotSpeed;
    });

    return (
        <group ref={meshRef} scale={data.scale}>
            {data.type === 'gift' ? (
                <mesh castShadow receiveShadow>
                    <boxGeometry />
                    <meshStandardMaterial color={Math.random() > 0.5 ? "#FFD700" : "#d40000"} metalness={0.8} roughness={0.2} />
                </mesh>
            ) : (
                <mesh castShadow receiveShadow>
                    {/* Cat Head Bauble */}
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshStandardMaterial color={Math.random() > 0.3 ? "#FFD700" : (Math.random() > 0.5 ? "#b8860b" : "#e6e6e6")} metalness={1} roughness={0.1} envMapIntensity={2} />
                    {/* Cat Ears */}
                    <mesh position={[-0.4, 0.6, 0]} rotation={[0,0,0.4]}>
                        <coneGeometry args={[0.3, 0.6, 16]} />
                        <meshStandardMaterial color="#FFD700" metalness={1} />
                    </mesh>
                    <mesh position={[0.4, 0.6, 0]} rotation={[0,0,-0.4]}>
                        <coneGeometry args={[0.3, 0.6, 16]} />
                        <meshStandardMaterial color="#FFD700" metalness={1} />
                    </mesh>
                </mesh>
            )}
        </group>
    );
}

const Topper = ({ progress }: { progress: React.MutableRefObject<number> }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame(() => {
        if(ref.current) {
            const t = progress.current;
            // The topper flies UP into the sky when unleashed
            const targetY = 5.5;
            const chaosY = 15.0; 
            ref.current.position.y = MathUtils.lerp(targetY, chaosY, t);
            ref.current.scale.setScalar(MathUtils.lerp(1, 2, t)); // Grows when chaotic
            ref.current.rotation.y += 0.05 + (t * 0.2); // Spins faster in chaos
        }
    })

    return (
        <group ref={ref} position={[0, 5.5, 0]}>
             <pointLight intensity={5} color="#FFD700" distance={10} />
             <mesh>
                 <sphereGeometry args={[0.6, 32, 32]} />
                 <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2} toneMapped={false} />
             </mesh>
             {/* Cat Halo */}
             <mesh rotation={[Math.PI/2, 0, 0]}>
                 <torusGeometry args={[1, 0.05, 16, 64]} />
                 <meshStandardMaterial color="white" emissive="white" emissiveIntensity={5} />
             </mesh>
             {/* Giant Cat Ears for Topper */}
             <mesh position={[-0.3, 0.5, 0]} rotation={[0, 0, 0.3]}>
                <coneGeometry args={[0.25, 0.6, 32]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1} />
             </mesh>
             <mesh position={[0.3, 0.5, 0]} rotation={[0, 0, -0.3]}>
                <coneGeometry args={[0.25, 0.6, 32]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1} />
             </mesh>
        </group>
    )
}

const GuardianCats = ({ progress }: { progress: React.MutableRefObject<number> }) => {
    const groupRef = useRef<THREE.Group>(null);
    
    // 3 Large cats sitting at the base in a triangle
    const cats = useMemo(() => [0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2;
        return {
            x: Math.cos(angle) * 4.5,
            z: Math.sin(angle) * 4.5,
            rot: -angle + Math.PI/2 // Face outward
        }
    }), []);
  
    useFrame(() => {
        if (groupRef.current) {
             const t = progress.current;
             // Guardians slide outwards when unleashed to make room for chaos
             const scale = 1 + t * 0.2;
             const spread = 1 + t * 0.5;
             
             groupRef.current.scale.setScalar(scale);
             groupRef.current.children.forEach((child, i) => {
                 const catDef = cats[i];
                 child.position.x = MathUtils.lerp(catDef.x, catDef.x * spread, t);
                 child.position.z = MathUtils.lerp(catDef.z, catDef.z * spread, t);
             });
        }
    });
  
    return (
        <group ref={groupRef}>
            {cats.map((cat, i) => (
                <group key={i} position={[cat.x, -4.5, cat.z]} rotation={[0, cat.rot, 0]}>
                    <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
                        {/* Body - Sleek Egyptian Style */}
                        <cylinderGeometry args={[0.6, 1.0, 3, 32]} />
                        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.05} envMapIntensity={3} />
                    </mesh>
                    <mesh position={[0, 3.2, 0.4]}>
                        {/* Head */}
                        <sphereGeometry args={[0.7, 32, 32]} />
                        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.05} envMapIntensity={3} />
                        {/* Ears */}
                        <mesh position={[-0.3, 0.6, 0]} rotation={[0,0,0.5]}>
                            <coneGeometry args={[0.2, 0.7, 32]} />
                            <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.05} />
                        </mesh>
                        <mesh position={[0.3, 0.6, 0]} rotation={[0,0,-0.5]}>
                            <coneGeometry args={[0.2, 0.7, 32]} />
                            <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.05} />
                        </mesh>
                        {/* Eyes */}
                        <mesh position={[-0.2, 0.1, 0.6]}>
                             <sphereGeometry args={[0.1, 16, 16]} />
                             <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
                        </mesh>
                        <mesh position={[0.2, 0.1, 0.6]}>
                             <sphereGeometry args={[0.1, 16, 16]} />
                             <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
                        </mesh>
                    </mesh>
                    {/* Base Plinth */}
                    <mesh position={[0, -0.2, 0]}>
                        <boxGeometry args={[2.5, 0.4, 2.5]} />
                        <meshStandardMaterial color="#001a0c" metalness={0.5} roughness={0.5} />
                    </mesh>
                </group>
            ))}
        </group>
    )
  }
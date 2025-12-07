import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Environment, 
  ContactShadows, 
  PerspectiveCamera,
  MeshReflectorMaterial,
  Html
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { LuxuryTree } from './LuxuryTree';
import * as THREE from 'three';

// --- GESTURE CONTROLLER COMPONENT ---
// Analyzes webcam feed for motion energy to drive the "Unleash" state
const GestureManager = ({ onUpdate }: { onUpdate: (energy: number, cx: number, cy: number) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
    const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
    const lastFrameData = useRef<Uint8ClampedArray | null>(null);

    useEffect(() => {
        const startVideo = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 128, height: 128 } });
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            } catch (e) {
                console.warn("Camera access denied or unavailable", e);
            }
        };
        startVideo();
    }, []);

    useFrame((state) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Draw video to small canvas for processing
            canvas.width = 64; // Low res for performance
            canvas.height = 64;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(video, 0, 0, 64, 64);
                const imageData = ctx.getImageData(0, 0, 64, 64);
                const data = imageData.data;
                
                let diffScore = 0;
                let activePixels = 0;
                let sumX = 0;
                let sumY = 0;

                // Simple Motion Detection: Difference from last frame
                if (lastFrameData.current) {
                    for (let i = 0; i < data.length; i += 4) {
                        const rDiff = Math.abs(data[i] - lastFrameData.current[i]);
                        const gDiff = Math.abs(data[i+1] - lastFrameData.current[i+1]);
                        const bDiff = Math.abs(data[i+2] - lastFrameData.current[i+2]);
                        
                        if (rDiff + gDiff + bDiff > 50) { // Threshold
                            diffScore++;
                            // Calculate Centroid of motion
                            const pixelIdx = i / 4;
                            const x = pixelIdx % 64;
                            const y = Math.floor(pixelIdx / 64);
                            sumX += x;
                            sumY += y;
                            activePixels++;
                        }
                    }
                }
                
                // Copy current to last
                lastFrameData.current = new Uint8ClampedArray(data);

                // Normalize energy (0 to 1)
                const energy = Math.min(diffScore / 500, 1);
                
                // Normalize Position (-1 to 1)
                const cx = activePixels > 0 ? (sumX / activePixels / 32) - 1 : 0;
                const cy = activePixels > 0 ? (sumY / activePixels / 32) - 1 : 0;

                onUpdate(energy, cx, cy);
            }
        }
    });

    return null;
}

const CameraController = ({ targetX, targetY }: { targetX: number, targetY: number }) => {
    const { camera } = useThree();
    useFrame((state, delta) => {
        // Smoothly move camera based on hand position (Parallax)
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX * 5, delta * 2);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4 - targetY * 2, delta * 2);
        camera.lookAt(0, 2, 0);
    });
    return null;
}

export const Experience: React.FC = () => {
  // State 0 (Tree) -> 1 (Chaos)
  const [unleashed, setUnleashed] = useState(false);
  const [motionEnergy, setMotionEnergy] = useState(0);
  const [handPos, setHandPos] = useState({ x: 0, y: 0 });

  // Fallback interaction (Mouse)
  const handlePointerDown = () => setUnleashed(true);
  const handlePointerUp = () => setUnleashed(false);
  const handlePointerMove = (e: any) => {
      // Map screen space to -1 to 1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      // Only control camera via mouse if motion energy is low (no camera user)
      if (motionEnergy < 0.2) {
        setHandPos({ x, y });
      }
  };

  const handleGestureUpdate = (energy: number, cx: number, cy: number) => {
      setMotionEnergy(energy);
      // If significant motion, update position and trigger unleash
      if (energy > 0.15) { 
        setHandPos({ x: -cx, y: cy }); // Mirror x
      }
      
      // Threshold logic: High energy = Unleash (Open hand/Waving), Low = Tree
      if (energy > 0.35) {
          setUnleashed(true);
      } else if (energy < 0.1) {
          setUnleashed(false);
      }
  };

  return (
    <div 
        className="w-full h-full"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
    >
        <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ antialias: false, toneMappingExposure: 1.0 }}
        camera={{ position: [0, 4, 18], fov: 35 }}
        >
        
        <color attach="background" args={['#000502']} />
        <fog attach="fog" args={['#000502', 10, 40]} />

        <Suspense fallback={null}>
            <GestureManager onUpdate={handleGestureUpdate} />
            <CameraController targetX={handPos.x} targetY={handPos.y} />

            {/* Cinematic Lighting */}
            <ambientLight intensity={0.2} />
            <spotLight 
            position={[10, 15, 10]} 
            angle={0.2} 
            penumbra={1} 
            intensity={20} 
            castShadow 
            shadow-bias={-0.0001}
            color="#ffeebf"
            />
            <pointLight position={[-10, 5, -5]} intensity={5} color="#00ff88" distance={20} />
            <pointLight position={[5, -2, 5]} intensity={5} color="#FFD700" distance={15} />

            {/* Main Content */}
            <group position={[0, -2, 0]}>
                <LuxuryTree isUnleashed={unleashed} />
                
                {/* Mirror Floor */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
                    <planeGeometry args={[100, 100]} />
                    <MeshReflectorMaterial
                    blur={[300, 100]}
                    resolution={1024}
                    mixBlur={1}
                    mixStrength={60}
                    roughness={0.5}
                    depthScale={1.2}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.4}
                    color="#000502"
                    metalness={0.8}
                    mirror={0.7}
                    />
                </mesh>
            </group>

            <Environment preset="lobby" />

            {/* Post Processing: The "Trump" Gold Glow */}
            <EffectComposer enableNormalPass={false}>
                <Bloom 
                    luminanceThreshold={0.6} // Glows easily
                    mipmapBlur 
                    intensity={1.5} 
                    radius={0.4} 
                />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
                <Noise opacity={0.05} />
            </EffectComposer>

        </Suspense>
        </Canvas>
        
        {/* Webcam Debug UI (Small corner view to confirm it's working) */}
        <div className="absolute bottom-4 left-4 w-24 h-24 border border-gold/30 opacity-50 overflow-hidden rounded-lg pointer-events-none">
             <div className="w-full h-full bg-black flex items-center justify-center text-[8px] text-white text-center">
                CAMERA INPUT<br/>ACTIVE
             </div>
        </div>
        
        {/* Interaction hint */}
        <div className="absolute bottom-10 w-full text-center pointer-events-none transition-opacity duration-500" style={{ opacity: unleashed ? 0 : 1 }}>
            <p className="text-[#FFD700] font-['Cinzel'] text-sm tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                {motionEnergy > 0 ? "Wave Hand to Unleash" : "Tap & Hold or Wave Camera"}
            </p>
        </div>
    </div>
  );
};
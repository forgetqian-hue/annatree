export type Vector3Array = [number, number, number];

export interface DualPose {
  target: Vector3Array; // The tree position
  chaos: Vector3Array;  // The explosion position
}

export interface ParticleData {
  position: DualPose;
  color: string;
  size: number;
  speed: number;
}

export type GestureState = 'IDLE' | 'UNLEASHED';

export interface CameraConfig {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

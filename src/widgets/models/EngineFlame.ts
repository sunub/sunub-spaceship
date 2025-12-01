
import * as THREE from 'three';
import type { GameContext, IGameObject } from '@/core/GameContext';
import { vertexShader, fragmentShader } from '../Shader/EngineFlameShader';

export class EngineFlame implements IGameObject {
  private context: GameContext | null = null;
  public modelGroup: THREE.Group;
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private material: THREE.ShaderMaterial | null = null;

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 2, 0)) {
    this.modelGroup = new THREE.Group();
    this.modelGroup.position.copy(position);
  }

  async initialize(context: GameContext): Promise<void> {
    this.context = context;

    // 1. Create Material
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        iTime: { value: 0.0 },
        iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // 2. Create Geometry (Plane)
    const geometry = new THREE.PlaneGeometry(2, 2);

    // 3. Create Mesh
    this.mesh = new THREE.Mesh(geometry, this.material);

    // 4. Add to group and scene
    this.context.scene.add(this.mesh);

    // 5. Listen for input actions if needed
    // this.context.inputManager.on('action:flight', this.handleFlightInput);
  }

  update(_deltaTime: number): void {
    if (this.context && this.material) {
      const elapsedTime = this.context.time.elapsed * 0.001; // ms to s
      this.material.uniforms.iTime.value = elapsedTime;
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.context?.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.material?.dispose();
  }
}

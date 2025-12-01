
// @ts-nocheck
import * as THREE from 'three';
import { BaseModel } from './BaseModel';
import { LandMaterial } from '../materials/LandMaterial';

export class LandModel extends BaseModel {
  private material: LandMaterial | null = null;

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    super('landModel', position);
  }

  async initialize(context: GameContext, addToScene: boolean = true): Promise<void> {
    this.context = context;

    this.material = new LandMaterial({
      side: THREE.DoubleSide,
    });

    await super.initialize(context, addToScene);
  }

  protected setupModelStructure(clonedModel: THREE.Object3D): void {
    super.setupModelStructure(clonedModel);

    this.mesh?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.material;
      }
    });
  }

  update(deltaTime: number): void {
    if (this.context && this.material) {
      const elapsedTime = this.context.time.elapsed * 0.001;
      this.material.uTime = elapsedTime;
    }
  }

  dispose(): void {
    this.material?.dispose();
    super.dispose();
  }
}

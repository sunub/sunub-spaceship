// @ts-nocheck
import * as THREE from 'three';
import type { GameContext, IGameObject } from '@/core/GameContext';
import { LandModel } from './LandModel';
import { TreeLights } from './TreeLights';
import { Crystal } from './Crystal';

export class Land implements IGameObject {
  private context: GameContext | null = null;
  public modelGroup: THREE.Group;
  
  private landModel: LandModel | null = null;
  private treeLights: TreeLights | null = null;
  private crystal: Crystal | null = null;
  private initialY: number = 0;

  constructor(private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    this.modelGroup = new THREE.Group();
    this.modelGroup.position.copy(position);
    this.initialY = position.y;
  }

  async initialize(context: GameContext): Promise<void> {
    this.context = context;

    // Create and initialize all parts of the land
    this.landModel = new LandModel();
    this.treeLights = new TreeLights();
    this.crystal = new Crystal();

    // Initialize them without adding to the scene, as we will group them
    await this.landModel.initialize(context, false);
    await this.treeLights.initialize(context, false);
    await this.crystal.initialize(context, false);

    // Add parts to the group
    if (this.landModel.modelGroup) {
      this.modelGroup.add(this.landModel.modelGroup);
    }
    if (this.treeLights.modelGroup) {
      this.modelGroup.add(this.treeLights.modelGroup);
    }
    if (this.crystal.modelGroup) {
      this.modelGroup.add(this.crystal.modelGroup);
    }

    // Add the final group to the scene
    this.context.scene.add(this.modelGroup);
  }

  update(deltaTime: number): void {
    if (this.context && this.modelGroup) {
      const elapsedTime = this.context.time.elapsed * 0.001; // ms to s
      
      // 3. 초기 위치를 기준으로 목표 지점 계산
      const oscillation = Math.sin(elapsedTime * 0.5) * 0.1;
      const targetY = this.initialY + oscillation; 
      const dampFactor = 2.0;
      const alpha = Math.min(dampFactor * deltaTime, 1.0); 
      
      this.modelGroup.position.y = THREE.MathUtils.lerp(
        this.modelGroup.position.y,
        targetY,
        alpha
      );

      this.modelGroup.rotation.y += 0.001;

      // Update sub-models
      this.landModel?.update(deltaTime);
      this.treeLights?.update(deltaTime);
      this.crystal?.update(deltaTime);
    }
  }

  dispose(): void {
    if (this.context) {
      this.context.scene.remove(this.modelGroup);
    }
    this.landModel?.dispose();
    this.treeLights?.dispose();
    this.crystal?.dispose();
  }
}

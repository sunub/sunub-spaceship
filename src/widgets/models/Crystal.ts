import * as THREE from 'three';
import { BaseModel } from './BaseModel';

export class Crystal extends BaseModel {
  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    super('crystalModel', position);
  }

  update(deltaTime: number): void {
    // No specific update logic for now
  }
}

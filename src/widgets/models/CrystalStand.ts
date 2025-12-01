import * as THREE from "three";
import { BaseModel } from "./BaseModel";

export class CrystalStand extends BaseModel {
  private rotationSpeed = 0.5; // 회전 속도 (라디안/초)

  constructor(position: THREE.Vector3 = new THREE.Vector3(-5, 0, 0)) {
    super("crystalStandModel", position);
  }

  protected onModelLoaded(): void {
    if (!this.mesh) return;
    
    // 크리스탈 스탠드 모델 특정 설정
    const bounds = this.getModelBounds();
    
    // 크리스탈 스탠드를 바닥에 맞춰 배치
    this.mesh.position.y = -bounds.center.y;
    
    // 크기 조정 (필요시)
    const scale = 0.8;
    this.mesh.scale.setScalar(scale);
    
    console.log(`💎 Crystal Stand loaded at position: ${this.position.x}, ${this.position.y}, ${this.position.z}`);
  }

  update(deltaTime: number): void {
    if (!this.mesh) return;
    
    // 크리스탈 스탠드를 천천히 회전시킴
    this.mesh.rotation.y += this.rotationSpeed * deltaTime;
  }
}

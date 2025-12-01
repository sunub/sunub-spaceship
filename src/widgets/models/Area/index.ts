import * as THREE from "three";
import type { IGameObject } from "@/core/GameContext";

export class Area implements IGameObject {
  private mesh: THREE.Mesh;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 10),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    )
    this.mesh.position.set(0, 0.5, 1.5);
  }

  async initialize(): Promise<void> {
    // 포트폴리오 영역 초기화 로직 구현
    console.log("PortfolioArea initialized");
  }

  update(deltaTime: number) {

  }
  
  dispose() {

  };
}

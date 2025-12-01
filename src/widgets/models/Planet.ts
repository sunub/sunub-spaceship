// @ts-nocheck
import * as THREE from "three";
import { BaseModel } from "./BaseModel";
import { PlanetMaterial } from "../materials/PlanetMaterial";
import { TweakPane } from "../TweakPane";

export class Planet extends BaseModel {
  private material: PlanetMaterial | null = null;

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    super("planet", position);
    this.position = position;
  }

  async initialize(context: GameContext): Promise<void> {
    this.context = context;

    // 행성 재질 생성
    this.material = new PlanetMaterial({
      transparent: true,
      uColorStop1: new THREE.Vector2(0.2, 0.8),
      uColorStop2: new THREE.Vector2(0.3, 0.7),
      uColor1: [1, 0.5, 0],
      uColor2: [0, 0, 1],
      uEmissionColor: [1, 0, 1],
      uEmissionStrength: 0.1,
    });

    this.debug();
    await super.initialize(context);
  }

  async debug() {
    const pane = TweakPane.getInstance();
    const f = pane.addFolder({
      title: "Planet Debug",
      expanded: true,
    });

    f.addBinding(this.position, "x", { min: -100, max: 100, step: 0.1 }).on("change", (ev) => {
      this.position.x = ev.value;
      if (this.modelGroup) {
        this.modelGroup.position.x = this.position.x;
      }
    });

    f.addBinding(this.position, "y", { min: -100, max: 100, step: 0.1 }).on("change", (ev) => {
      this.position.y = ev.value;
      if (this.modelGroup) {
        this.modelGroup.position.y = this.position.y;
      }
    });

    f.addBinding(this.position, "z", { min: -100, max: 100, step: 0.1 }).on("change", (ev) => {
      this.position.z = ev.value;
      if (this.modelGroup) {
        this.modelGroup.position.z = this.position.z;
      }
    });
  }

  protected setupModelStructure(clonedModel: THREE.Object3D): void {
    super.setupModelStructure(clonedModel);

    this.mesh?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.material;
      }
    });
    this.mesh?.scale.set(1, 1, 1);
  }

  update(deltaTime: number): void {
    // 시간 업데이트 (컨텍스트의 시간을 사용)
    if (this.material && this.context) {
      this.material.uTime = this.context.time.elapsed * 0.001; // ms를 s로 변환
    }
  }

  dispose(): void {
    // 재질 정리
    this.material?.dispose();
    super.dispose();
  }
}

import * as THREE from "three/webgpu";
import { GridMaterial } from "./materials/GridMaterial";
import { TweakPane } from "./TweakPane";
import * as RAPIER from "@dimforge/rapier3d-compat";
import type { GameContext, IGameObject } from "../core/GameContext";

export class Floor extends THREE.Mesh implements IGameObject {
  private context: GameContext | null = null;
  private size: number = 100;
  private gridMaterial: GridMaterial;
  private gridOptions: {
    gridScale: number;
    gridThickness: number;
    gridDensity: number;
  } = {
    gridScale: 64.0,
    gridThickness: 0.01,
    gridDensity: 10.0,
  };

  constructor(size: number = 100) {
    super();
    this.size = size;
    
    // GridMaterial 생성
    this.gridMaterial = new GridMaterial({
      gridScale: this.gridOptions.gridScale,
      gridThickness: this.gridOptions.gridThickness,
      gridDensity: this.gridOptions.gridDensity,
    });
    
    // Three.js 메쉬 설정
    this.geometry = new THREE.PlaneGeometry(this.size, this.size);
    this.material = this.gridMaterial;
    this.rotation.x = -Math.PI / 2; // 바닥이 되도록 회전
  }

  async initialize(context: GameContext) {
    this.context = context;
    this.setUpPhysics();
    this.setUpTweakPane();
    
    // 씬에 자동으로 추가
    context.scene.add(this);
  }

  update(_deltaTime: number) {
    // Floor는 정적 객체이므로 업데이트할 것이 없음
  }

  private setUpPhysics() {
    if (!this.context) return;
    
    // RigidBody 생성 설명자(Descriptor)를 만듭니다.
    // 'fixed' 타입은 중력의 영향을 받지 않고 움직이지 않는 고정된 객체를 의미합니다.
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
    
    // Three.js 메쉬의 위치를 물리 객체에 설정합니다.
    // 이 부분이 물리 엔진 세계에서의 박스 모델의 위치와 실제 모델이 렌더되는 세계의 위치를 일치시키는 역할을 합니다.
    // 이 부분을 제대로 설정하지 않을 경우 물리 충돌이 올바르게 작동하지 않을 수 있습니다.
    rigidBodyDesc.setTranslation(this.position.x, this.position.y, this.position.z);
    
    // 물리 세계(world)에 RigidBody를 생성합니다.
    // 물리 엔진을 구현할 때 물리엔진의 세계와 렌더링 엔진의 세계가 일치하도록 하는 것이 매우 중요합니다.
    // 여기서는 GameContext를 통해 Physics 서비스에 접근하여 물리 세계에 바닥을 추가합니다.
    // 물리 엔진의 세계에 추가된 객체는 물리 시뮬레이션에 참여하게 됩니다.
    // 바닥은 고정된 객체이므로 다른 동적 객체들과 충돌할 수 있습니다.
    // 예를 들어, 우주선이 바닥과 충돌하면 물리 엔진이 이를 감지하고 적절한 반응을 계산합니다.
    const rigidBody = this.context.physics.world.createRigidBody(rigidBodyDesc);

    // Collider 생성 설명자(Descriptor)를 만듭니다.
    // Cuboid(직육면체, hx, hy, hz) 형태를 사용합니다. RAPIER는 '반쪽 길이(half-extents)'를 인자로 받습니다.
    // 바닥이므로 y축 두께는 매우 얇게 설정합니다.
    const colliderDesc = RAPIER.ColliderDesc.cuboid(this.size / 2.0, 0.1, this.size / 2.0);

    // 물리 세계에 Collider를 생성하고 위에서 만든 RigidBody에 붙여줍니다.
    this.context.physics.world.createCollider(colliderDesc, rigidBody);
  }

  private setUpTweakPane() {
    const pane = TweakPane.getInstance();

    const f = pane.addFolder({
      title: "Grid Material",
      expanded: true,
    });

    f.addBinding(this.gridOptions, "gridScale", {
      min: 8.0,
      max: 128.0,
      step: 4,
      label: "Grid Scale",
    }).on("change", (ev: any) => {
      this.gridMaterial.setGridScale(ev.value);
    });
    
    f.addBinding(this.gridOptions, "gridThickness", {
      min: 0.001,
      max: 0.1,
      step: 0.001,
      label: "Grid Thickness",
    }).on("change", (ev: any) => {
      this.gridMaterial.setGridThickness(ev.value);
    });
    
    f.addBinding(this.gridOptions, "gridDensity", {
      min: 1.0,
      max: 20.0,
      step: 0.1,
      label: "Grid Density",
    }).on("change", (ev: any) => {
      this.gridMaterial.setGridDensity(ev.value);
    });
  }

  dispose() {
    if (this.context) {
      this.context.scene.remove(this);
    }
  }
}

import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import type { GameContext, IGameObject } from "../../core/GameContext";

/**
 * 기본 모델 클래스 - Resources를 사용하여 GLTF 모델을 로드하는 공통 로직 제공
 */
export abstract class BaseModel implements IGameObject {
  protected context: GameContext | null = null;
  protected modelGroup: THREE.Object3D | null = null;
  protected mesh: THREE.Object3D | null = null;
  protected rigidBody: RAPIER.RigidBody | null = null;
  
  constructor(
    protected modelName: string,
    protected position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  ) {}

  async initialize(context: GameContext): Promise<void> {
    this.context = context;
    await this.loadModel();
    await this.setupPhysics();
    this.onModelLoaded();
  }

  protected async loadModel(): Promise<void> {
    if (!this.context) {
      throw new Error("Context not available during model loading");
    }

    const { scene, resources } = this.context;
    
    // Resources에서 모델 가져오기
    const modelScene = resources.getModel(this.modelName);
    if (!modelScene) {
      throw new Error(`Model '${this.modelName}' not found in resources. Check sources.ts configuration.`);
    }
    
    // 🔧 하위 클래스에서 모델 구조를 커스터마이징할 수 있도록 훅 제공
    const clonedModel = modelScene.clone();
    this.setupModelStructure(clonedModel);
    
    // 위치 설정
    if (this.modelGroup) {
      this.modelGroup.position.copy(this.position);
      // 씬에 추가
      scene.add(this.modelGroup);
    }
  }

  /**
   * 🏗️ 모델 구조 설정 - 하위 클래스에서 오버라이드하여 커스터마이징
   * 기본 구현: 단순한 modelGroup + mesh 구조
   */
  protected setupModelStructure(clonedModel: THREE.Object3D): void {
    this.modelGroup = new THREE.Object3D();
    this.modelGroup.name = `${this.modelName}Group`;
    
    this.mesh = clonedModel;
    this.modelGroup.add(this.mesh);
  }

  /**
   * ⚙️ 물리 설정 - 필요한 모델에서만 오버라이드
   */
  protected async setupPhysics(): Promise<void> {
    // 기본적으로는 물리 설정 없음
    // 하위 클래스에서 필요시 오버라이드
  }

  /**
   * 모델 로드 완료 후 호출되는 훅 메서드
   * 하위 클래스에서 오버라이드하여 추가 설정 구현
   */
  protected onModelLoaded(): void {
    // 하위 클래스에서 구현
  }

  /**
   * 모델의 크기와 경계박스 정보를 반환
   */
  protected getModelBounds(): { size: THREE.Vector3; center: THREE.Vector3; box: THREE.Box3 } {
    if (!this.mesh) {
      throw new Error("Model not loaded yet");
    }
    
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    return { size, center, box };
  }

  abstract update(deltaTime: number): void;

  dispose(): void {
    // 물리 정리
    if (this.rigidBody && this.context) {
      this.context.physics.world.removeRigidBody(this.rigidBody);
    }
    
    // 3D 객체 정리
    if (this.modelGroup && this.context) {
      this.context.scene.remove(this.modelGroup);
    }
  }
}

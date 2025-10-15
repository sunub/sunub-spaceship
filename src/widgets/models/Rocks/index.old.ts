import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { BaseModel } from "../BaseModel";
import { RocksPositionDebuger } from "./models/Rocks.PositionDebug";
import { TweakPane } from "@/widgets/TweakPane";

interface RockPiece {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  originalPosition: THREE.Vector3;
  debugBox?: THREE.Mesh; // 물리 바운딩 박스 시각화
}

interface RockInstance {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  rigidBody?: RAPIER.RigidBody;
}

interface DebugOptions {
  showPhysicsBoxes: boolean;
  showModelBounds: boolean;
  showPositionMarkers: boolean;
}

interface InstanceOptions {
  enabled: boolean;
  count: number;
  areaSize: number;
  minScale: number;
  maxScale: number;
  spacing: number;
  randomSeed: number;
}

export interface PositionOptions {
  positionX: number;
  positionY: number;
  positionZ: number;
}

export class Rocks extends BaseModel {
  private scale: number = 1;
  private rockPieces: RockPiece[] = [];
  private meshesToProcess: THREE.Mesh[] = [];
  private debugOptions: DebugOptions = {
    showPhysicsBoxes: true,
    showModelBounds: true,
    showPositionMarkers: true
  };
  private debugGroup: THREE.Group = new THREE.Group();
  private modelBoundsHelper?: THREE.Box3Helper;
  private positionDebuger: RocksPositionDebuger;

  // Instance mode properties
  private instanceOptions: InstanceOptions = {
    enabled: false,
    count: 50,
    areaSize: 100,
    minScale: 0.5,
    maxScale: 2.0,
    spacing: 2.0,
    randomSeed: 12345
  };
  private rockInstances: RockInstance[] = [];
  private instancedMeshes: THREE.InstancedMesh[] = [];

  private positionOptions = {
    positionX: -26,
    positionY: 0,
    positionZ: -16
  }

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 1, 0), useInstances: boolean = false) {
    super("rocksModel", position);

    this.instanceOptions.enabled = useInstances;
    this.positionDebuger = new RocksPositionDebuger(this.positionOptions);
    this.setupTweakPane();
  }

  private setupTweakPane(): void {
    const pane = TweakPane.getInstance();
    const f = pane.addFolder({
      title: "Rocks Debug Controls",
      expanded: true,
    });
    
    // Position debugging controls
    this.positionDebuger.setupDebugControls(f, (options: PositionOptions) => {
      this.updatePosition(options);
    });

    // Instance mode toggle
    f.addBinding(this.instanceOptions, 'enabled', {
      label: 'Use Instances'
    }).on('change', () => this.toggleInstanceMode());

    // Instance controls (only show when instance mode is enabled)
    if (this.instanceOptions.enabled) {
      this.addInstanceControls(f);
    }
  }

  private addInstanceControls(folder: any): void {
    folder.addBinding(this.instanceOptions, 'count', { 
      min: 1, 
      max: 200, 
      step: 1,
      label: 'Count'
    }).on('change', () => this.regenerateInstances());

    folder.addBinding(this.instanceOptions, 'areaSize', { 
      min: 10, 
      max: 500, 
      step: 10,
      label: 'Area Size'
    }).on('change', () => this.regenerateInstances());

    folder.addBinding(this.instanceOptions, 'minScale', { 
      min: 0.1, 
      max: 5.0, 
      step: 0.1,
      label: 'Min Scale'
    }).on('change', () => this.regenerateInstances());

    folder.addBinding(this.instanceOptions, 'maxScale', { 
      min: 0.1, 
      max: 5.0, 
      step: 0.1,
      label: 'Max Scale'
    }).on('change', () => this.regenerateInstances());

    folder.addBinding(this.instanceOptions, 'spacing', { 
      min: 0.5, 
      max: 10.0, 
      step: 0.1,
      label: 'Spacing'
    }).on('change', () => this.regenerateInstances());

    folder.addButton({ title: 'Regenerate Instances' })
      .on('click', () => {
        this.instanceOptions.randomSeed = Math.random() * 100000;
        this.regenerateInstances();
      });
  }

  protected setupModelStructure(clonedModel: THREE.Object3D): void {
    this.modelGroup = new THREE.Object3D();
    this.modelGroup.name = `${this.modelName}Group`;
    
    // GLB 파일에서 모든 mesh들을 찾아서 분리
    this.extractMeshesFromModel(clonedModel);
    
    if (this.instanceOptions.enabled) {
      // 인스턴스 모드: 메시들을 템플릿으로만 사용
      this.mesh = this.meshesToProcess[0] || clonedModel;
    } else {
      // 단일 모드: 기존 로직 유지
      this.meshesToProcess.forEach(mesh => {
        this.modelGroup!.add(mesh);
      });
      // 첫 번째 mesh를 메인 mesh로 설정 (호환성 유지)
      this.mesh = this.meshesToProcess[0] || clonedModel;
    }
  }

  /**
   * 복합 오브젝트에서 모든 Mesh를 재귀적으로 추출
   */
  private extractMeshesFromModel(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh) {
      // Mesh를 복제하여 독립적인 객체로 만들기
      const clonedMesh = object.clone();
      clonedMesh.material = object.material; // 재질 공유는 유지
      
      // 원본 객체의 로컬 변환만 적용 (월드 변환은 나중에 처리)
      clonedMesh.position.copy(object.position);
      clonedMesh.rotation.copy(object.rotation);
      clonedMesh.scale.copy(object.scale);
      
      this.meshesToProcess.push(clonedMesh);
    }

    // 자식 객체들도 재귀적으로 처리
    object.children.forEach(child => {
      this.extractMeshesFromModel(child);
    });
  }

  protected onModelLoaded(): void {
    if (!this.mesh || this.meshesToProcess.length === 0 || !this.modelGroup) {
      return;
    }
    
    if (this.instanceOptions.enabled) {
      this.setupInstanceMode();
    } else {
      this.setupSingleMode();
    }
  }

  private setupSingleMode(): void {
    // 기존 단일 모드 로직
    this.modelGroup!.scale.setScalar(this.scale);
    const scaledBounds = this.getModelBounds();
    
    const floorHeight = this.positionOptions.positionY;
    const rockBottomY = scaledBounds.box.min.y;
    this.modelGroup!.position.y = floorHeight - rockBottomY;
    this.modelGroup!.position.x = this.positionOptions.positionX;
    this.modelGroup!.position.z = this.positionOptions.positionZ;
    
    this.setupPhysicsAfterPositioning();
  }

  private setupInstanceMode(): void {
    this.generateInstances();
    this.createInstancedMeshes();
    this.setupInstancePhysics();
  }
    this.modelGroup.position.z = this.positionOptions.positionZ;
    
    // 모델 위치 조정 완료 후 물리 바디 생성
    this.setupPhysicsAfterPositioning();
  }

  protected async setupPhysics(): Promise<void> {
    // 빈 구현 - 실제 물리 설정은 onModelLoaded()에서 호출
    // BaseModel의 초기화 순서 때문에 여기서는 아무것도 하지 않음
  }

  private async setupPhysicsAfterPositioning(): Promise<void> {
    if (!this.context || this.meshesToProcess.length === 0) return;

    // 각 mesh에 대해 개별적으로 물리 바디 생성
    for (const mesh of this.meshesToProcess) {
      await this.createPhysicsForMesh(mesh);
    }
  }

  private async createPhysicsForMesh(mesh: THREE.Mesh): Promise<void> {
    if (!mesh.geometry || !this.modelGroup) return;
    const { physics } = this.context!;

    // Mesh의 geometry에서 충돌체 생성
    const geometry = mesh.geometry;
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index?.array;

    // ConvexHull 또는 TriMesh 충돌체 생성
    let colliderDesc: RAPIER.ColliderDesc | null = null;
    
    if (indices && indices.length > 0) {
      // 인덱스가 있는 경우 TriMesh 사용 (정확한 충돌 감지)
      colliderDesc = RAPIER.ColliderDesc.trimesh(
        new Float32Array(vertices),
        new Uint32Array(indices)
      );
    } else {
      // 인덱스가 없는 경우 ConvexHull 사용 (성능 우선)
      colliderDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    }

    if (!colliderDesc) {
      console.warn("Failed to create collider for rock piece");
      return;
    }

    // 정적 리지드 바디 생성 (바위는 움직이지 않음)
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
    
    // 모델 그룹의 월드 변환을 포함한 mesh의 실제 위치 계산
    this.modelGroup.updateMatrixWorld();
    mesh.updateMatrixWorld();
    
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    
    // mesh의 로컬 위치에 modelGroup의 변환 적용
    const meshWorldMatrix = new THREE.Matrix4();
    meshWorldMatrix.multiplyMatrices(this.modelGroup.matrixWorld, mesh.matrix);
    meshWorldMatrix.decompose(worldPosition, worldQuaternion, worldScale);
    
    
    rigidBodyDesc.setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
    rigidBodyDesc.setRotation({
      x: worldQuaternion.x,
      y: worldQuaternion.y,
      z: worldQuaternion.z,
      w: worldQuaternion.w
    });

    const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
    physics.world.createCollider(colliderDesc, rigidBody);

    let debugBox: THREE.Mesh | undefined;
    if (this.debugOptions.showPhysicsBoxes) {
      debugBox = this.createPhysicsDebugBox(worldPosition, worldQuaternion, worldScale, mesh);
      this.debugGroup.add(debugBox);
    }

    this.rockPieces.push({
      mesh,
      rigidBody,
      originalPosition: worldPosition.clone(),
      debugBox
    });
  }

  /**
   * 물리 바운딩 박스 시각화 생성
   */
  private createPhysicsDebugBox(
    position: THREE.Vector3, 
    quaternion: THREE.Quaternion, 
    scale: THREE.Vector3,
    originalMesh: THREE.Mesh
  ): THREE.Mesh {
    // 원본 mesh의 geometry 경계박스를 기반으로 크기 계산
    const bbox = new THREE.Box3().setFromObject(originalMesh);
    const size = bbox.getSize(new THREE.Vector3());
    
    // 박스 지오메트리 생성 (스케일 적용)
    const geometry = new THREE.BoxGeometry(
      size.x * scale.x, 
      size.y * scale.y, 
      size.z * scale.z
    );
    
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff00ff, 
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    
    const debugBox = new THREE.Mesh(geometry, material);
    debugBox.position.copy(position);
    debugBox.quaternion.copy(quaternion);
    debugBox.name = `PhysicsBox_${originalMesh.name || 'unnamed'}`;
    
    return debugBox;
  }

  update(_deltaTime: number): void {
    // 바위는 정적 객체이므로 기본적으로 업데이트 로직 없음
    // 필요시 파괴 효과나 애니메이션 추가 가능
    
    // 디버깅: 물리 바디와 메시 위치 동기화 확인
    if (this.debugOptions.showPhysicsBoxes) {
      this.updatePhysicsDebugVisualization();
    }
    
    // 동적 바위 조각들의 위치 동기화 (파괴 효과 등에서 사용)
    this.rockPieces.forEach(piece => {
      if (piece.rigidBody.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        const position = piece.rigidBody.translation();
        const rotation = piece.rigidBody.rotation();
        
        piece.mesh.position.set(position.x, position.y, position.z);
        piece.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }

  /**
   * 물리 디버그 시각화 업데이트
   */
  private updatePhysicsDebugVisualization(): void {
    this.rockPieces.forEach(piece => {
      if (piece.debugBox) {
        const translation = piece.rigidBody.translation();
        const rotation = piece.rigidBody.rotation();
        
        piece.debugBox.position.set(translation.x, translation.y, translation.z);
        piece.debugBox.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }

  /**
   * TweakPane에서 호출되는 위치 업데이트 메서드
   */
  private updatePosition(options: PositionOptions): void {
    if (this.modelGroup) {
      // 모델 그룹 위치 업데이트
      const scaledBounds = this.getModelBounds();
      const rockBottomY = scaledBounds.box.min.y;
      
      this.modelGroup.position.x = options.positionX;
      this.modelGroup.position.y = options.positionY - rockBottomY;
      this.modelGroup.position.z = options.positionZ;

      // 물리 바디들 위치도 업데이트
      this.updatePhysicsBodies();
    }
  }

  /**
   * 물리 바디들의 위치를 새로운 모델 위치에 맞게 업데이트
   */
  private updatePhysicsBodies(): void {
    if (!this.context || !this.modelGroup) return;

    const { physics } = this.context;

    // 기존 물리 바디들 제거
    this.rockPieces.forEach(piece => {
      physics.world.removeRigidBody(piece.rigidBody);
      if (piece.debugBox) {
        this.debugGroup.remove(piece.debugBox);
      }
    });

    // 물리 바디들 재생성
    this.rockPieces.length = 0;
    this.setupPhysicsAfterPositioning();
  }

  /**
   * 특정 바위 조각을 동적 객체로 변경 (예: 파괴 효과)
   */
  makeRockPieceDynamic(pieceIndex: number): void {
    if (pieceIndex < 0 || pieceIndex >= this.rockPieces.length) return;
    
    const piece = this.rockPieces[pieceIndex];
    piece.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    
    const impulse = { x: (Math.random() - 0.5) * 2, y: 1, z: (Math.random() - 0.5) * 2 };
    piece.rigidBody.applyImpulse(impulse, true);
  }

  getRockPieces(): readonly RockPiece[] {
    return this.rockPieces;
  }

  dispose(): void {
    // 각 rock piece의 물리 바디 정리
    if (this.context) {
      this.rockPieces.forEach(piece => {
        this.context!.physics.world.removeRigidBody(piece.rigidBody);
      });
      
      // 디버그 그룹 정리
      this.context.scene.remove(this.debugGroup);
    }
    
    // 디버그 요소들 정리
    this.debugGroup.clear();
    if (this.modelBoundsHelper) {
      this.modelBoundsHelper.dispose();
    }
    
    this.rockPieces.length = 0;
    this.meshesToProcess.length = 0;
    
    // 부모 클래스의 정리 메서드 호출
    super.dispose();
  }
}

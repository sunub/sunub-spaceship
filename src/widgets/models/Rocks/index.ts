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
    count: 5,
    areaSize: 100,
    minScale: 0.5,
    maxScale: 1.5,
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

  private generateInstances(): void {
    this.rockInstances = [];
    const random = this.createSeededRandom(this.instanceOptions.randomSeed);
    
    for (let i = 0; i < this.instanceOptions.count; i++) {
      const position = this.generateInstancePosition(i, random);
      const rotation = new THREE.Euler();
      
      const scaleValue = this.instanceOptions.minScale + 
        random() * (this.instanceOptions.maxScale - this.instanceOptions.minScale);
      const scale = new THREE.Vector3(scaleValue, scaleValue, scaleValue);
      
      const matrix = new THREE.Matrix4();
      matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
      
      this.rockInstances.push({
        position,
        rotation,
        scale,
        matrix
      });
    }
  }

  private generateInstancePosition(index: number, random: () => number): THREE.Vector3 {
    const maxAttempts = 30;
    const minDistance = this.instanceOptions.spacing;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = (random() - 0.5) * this.instanceOptions.areaSize;
      const z = (random() - 0.5) * this.instanceOptions.areaSize;
      const position = new THREE.Vector3(x, this.positionOptions.positionY, z);
      
      const tooClose = this.rockInstances.some(instance => 
        instance.position.distanceTo(position) < minDistance
      );
      
      if (!tooClose) {
        return position;
      }
    }
    
    // 폴백: 그리드 배치
    const gridSize = Math.ceil(Math.sqrt(this.instanceOptions.count));
    const x = (index % gridSize) * this.instanceOptions.spacing - 
              (gridSize * this.instanceOptions.spacing) / 2;
    const z = Math.floor(index / gridSize) * this.instanceOptions.spacing - 
              (gridSize * this.instanceOptions.spacing) / 2;
    
    return new THREE.Vector3(x, this.positionOptions.positionY, z);
  }

  private createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  private createInstancedMeshes(): void {
    // 기존 인스턴스드 메시 정리
    this.instancedMeshes.forEach(mesh => {
      this.modelGroup?.remove(mesh);
      mesh.dispose();
    });
    this.instancedMeshes = [];

    // 각 메시 템플릿에 대해 인스턴스드 메시 생성
    this.meshesToProcess.forEach((template, templateIndex) => {
      const instancedMesh = new THREE.InstancedMesh(
        template.geometry,
        template.material,
        this.instanceOptions.count
      );
      
      instancedMesh.name = `RockInstanced_${templateIndex}`;
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      
      // 각 인스턴스의 변환 행렬 설정
      this.rockInstances.forEach((instance, index) => {
        instancedMesh.setMatrixAt(index, instance.matrix);
      });
      
      instancedMesh.instanceMatrix.needsUpdate = true;
      
      this.instancedMeshes.push(instancedMesh);
      this.modelGroup?.add(instancedMesh);
    });
  }

  private async setupInstancePhysics(): Promise<void> {
    if (!this.context || this.meshesToProcess.length === 0) return;
    
    const { physics } = this.context;
    const template = this.meshesToProcess[0];
    
    // 공통 충돌체 모양 생성
    const geometry = template.geometry;
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index?.array;
    
    let colliderDesc: RAPIER.ColliderDesc | null = null;
    
    if (indices && indices.length > 0) {
      colliderDesc = RAPIER.ColliderDesc.trimesh(
        new Float32Array(vertices),
        new Uint32Array(indices)
      );
    } else {
      colliderDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    }
    
    if (!colliderDesc) return;
    
    // 각 인스턴스에 대해 물리 바디 생성
    this.rockInstances.forEach((instance) => {
      const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
      rigidBodyDesc.setTranslation(instance.position.x, instance.position.y, instance.position.z);
      
      const quaternion = new THREE.Quaternion().setFromEuler(instance.rotation);
      rigidBodyDesc.setRotation({
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      });
      
      const rigidBody = physics.world.createRigidBody(rigidBodyDesc);
      
      // Note: Create scaled vertices for each instance
      const scaledVertices = new Float32Array(vertices.length);
      for (let i = 0; i < vertices.length; i += 3) {
        scaledVertices[i] = vertices[i] * instance.scale.x;
        scaledVertices[i + 1] = vertices[i + 1] * instance.scale.y;
        scaledVertices[i + 2] = vertices[i + 2] * instance.scale.z;
      }
      
      let scaledColliderDesc: RAPIER.ColliderDesc;
      if (indices && indices.length > 0) {
        scaledColliderDesc = RAPIER.ColliderDesc.trimesh(
          scaledVertices,
          new Uint32Array(indices)
        );
      } else {
        const convexDesc = RAPIER.ColliderDesc.convexHull(scaledVertices);
        if (!convexDesc) return; // Skip if convex hull creation fails
        scaledColliderDesc = convexDesc;
      }
      
      physics.world.createCollider(scaledColliderDesc, rigidBody);
      
      instance.rigidBody = rigidBody;
    });
  }

  private toggleInstanceMode(): void {
    // 기존 물리 바디들 정리
    this.cleanupCurrentMode();
    
    // TweakPane 재설정
    this.setupTweakPane();
    
    // 모델 재로드
    if (this.mesh) {
      this.onModelLoaded();
    }
  }

  private cleanupCurrentMode(): void {
    if (!this.context) return;
    
    const { physics } = this.context;
    
    // 단일 모드 정리
    this.rockPieces.forEach(piece => {
      physics.world.removeRigidBody(piece.rigidBody);
    });
    this.rockPieces = [];
    
    // 인스턴스 모드 정리
    this.rockInstances.forEach(instance => {
      if (instance.rigidBody) {
        physics.world.removeRigidBody(instance.rigidBody);
      }
    });
    this.rockInstances = [];
    
    // 인스턴스드 메시 정리
    this.instancedMeshes.forEach(mesh => {
      this.modelGroup?.remove(mesh);
      mesh.dispose();
    });
    this.instancedMeshes = [];
    
    // 모델 그룹 정리
    if (this.modelGroup) {
      this.modelGroup.clear();
    }
  }

  private regenerateInstances(): void {
    if (!this.instanceOptions.enabled) return;
    
    this.cleanupCurrentMode();
    this.setupInstanceMode();
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
      colliderDesc = RAPIER.ColliderDesc.trimesh(
        new Float32Array(vertices),
        new Uint32Array(indices)
      );
    } else {
      colliderDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    }

    if (!colliderDesc) {
      console.warn('Failed to create collider for mesh:', mesh.name);
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
      debugBox = this.createPhysicsDebugBox(mesh, worldPosition, worldQuaternion, worldScale);
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
  private createPhysicsDebugBox(originalMesh: THREE.Mesh, position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3): THREE.Mesh {
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

  protected getModelBounds(): { size: THREE.Vector3; center: THREE.Vector3; box: THREE.Box3 } {
    if (!this.modelGroup) {
      throw new Error('ModelGroup이 초기화되지 않았습니다');
    }

    const box = new THREE.Box3().setFromObject(this.modelGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    return { size, center, box };
  }

  update(_deltaTime: number): void {
    if (this.instanceOptions.enabled) {
      // 인스턴스 모드: 특별한 업데이트 로직 없음
      return;
    }
    
    // 단일 모드: 기존 업데이트 로직
    if (this.debugOptions.showPhysicsBoxes) {
      this.updatePhysicsDebugVisualization();
    }
    
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
      if (piece.debugBox && piece.rigidBody) {
        const position = piece.rigidBody.translation();
        const rotation = piece.rigidBody.rotation();
        
        piece.debugBox.position.set(position.x, position.y, position.z);
        piece.debugBox.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    });
  }

  /**
   * TweakPane에서 호출되는 위치 업데이트 메서드
   */
  private updatePosition(options: PositionOptions): void {
    if (!this.modelGroup) return;
    
    this.positionOptions.positionX = options.positionX;
    this.positionOptions.positionY = options.positionY;
    this.positionOptions.positionZ = options.positionZ;
    
    this.modelGroup.position.x = options.positionX;
    this.modelGroup.position.y = options.positionY;
    this.modelGroup.position.z = options.positionZ;
    
    this.updatePhysicsBodies();
  }

  /**
   * 물리 바디들의 위치를 새로운 모델 위치에 맞게 업데이트
   */
  private updatePhysicsBodies(): void {
    if (!this.context || !this.modelGroup) return;
    
    this.rockPieces.forEach(piece => {
      // 원래 상대 위치에 새로운 모델 위치 추가
      const newPosition = piece.originalPosition.clone().add(this.modelGroup!.position);
      
      piece.rigidBody.setTranslation(newPosition, true);
      
      // 디버그 박스도 함께 업데이트
      if (piece.debugBox) {
        piece.debugBox.position.copy(newPosition);
      }
    });
  }

  /**
   * 특정 바위 조각을 동적으로 변경 (단일 모드)
   */
  makeRockPieceDynamic(pieceIndex: number): void {
    if (pieceIndex < 0 || pieceIndex >= this.rockPieces.length) return;
    
    const piece = this.rockPieces[pieceIndex];
    piece.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    
    // 랜덤한 충격 가하기
    const impulse = { x: (Math.random() - 0.5) * 5, y: Math.random() * 3 + 1, z: (Math.random() - 0.5) * 5 };
    piece.rigidBody.applyImpulse(impulse, true);
  }

  /**
   * 인스턴스 모드에서 특정 바위를 동적으로 만들기
   */
  makeInstanceDynamic(instanceIndex: number): void {
    if (!this.instanceOptions.enabled || instanceIndex >= this.rockInstances.length) return;
    
    const instance = this.rockInstances[instanceIndex];
    if (!instance.rigidBody) return;
    
    instance.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    
    const impulse = { 
      x: (Math.random() - 0.5) * 5, 
      y: Math.random() * 3 + 1, 
      z: (Math.random() - 0.5) * 5 
    };
    instance.rigidBody.applyImpulse(impulse, true);
  }

  getRockPieces(): readonly RockPiece[] {
    return this.rockPieces;
  }

  getRockInstances(): readonly RockInstance[] {
    return this.rockInstances;
  }

  isInstanceMode(): boolean {
    return this.instanceOptions.enabled;
  }

  dispose(): void {
    this.cleanupCurrentMode();
    
    this.debugGroup.clear();
    if (this.modelBoundsHelper) {
      this.modelBoundsHelper.dispose();
    }
    
    this.meshesToProcess = [];
    
    super.dispose();
  }
}

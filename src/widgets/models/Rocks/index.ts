import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { BaseModel } from "../BaseModel";
import { RocksPositionDebuger } from "./models/Rocks.PositionDebug";
import { TweakPane } from "@/widgets/TweakPane";

interface RockInstance {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  rigidBody?: RAPIER.RigidBody;
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
  private meshesToProcess: THREE.Mesh[] = [];
  private positionDebuger: RocksPositionDebuger;

  // Instance mode properties
  private instanceOptions: InstanceOptions = {
    enabled: true,
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

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 1, 0)) {
    super("rocksModel", position);

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

    // Instance controls
    this.addInstanceControls(f);
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

    // 디버깅을 위한 물리 바디 정보 출력
    folder.addButton({ title: 'Debug Physics Info' })
      .on('click', () => {
        console.log('=== Rocks Physics Debug Info ===');
        console.log(`Total meshesToProcess: ${this.meshesToProcess.length}`);
        console.log(`Total rockInstances: ${this.rockInstances.length}`);
        console.log(`Instances with physics: ${this.rockInstances.filter(i => i.rigidBody).length}`);
        
        this.meshesToProcess.forEach((mesh, index) => {
          console.log(`Mesh ${index}: ${mesh.name || 'unnamed'}, vertices: ${mesh.geometry.attributes.position.count}`);
        });
        
        this.rockInstances.forEach((instance, index) => {
          if (instance.rigidBody) {
            const colliders = instance.rigidBody.numColliders();
            console.log(`Instance ${index}: ${colliders} colliders`);
          } else {
            console.log(`Instance ${index}: No physics body!`);
          }
        });
      });
  }

  protected setupModelStructure(clonedModel: THREE.Object3D): void {
    this.modelGroup = new THREE.Object3D();
    this.modelGroup.name = `${this.modelName}Group`;
    
    // GLB 파일에서 모든 mesh들을 찾아서 분리
    this.extractMeshesFromModel(clonedModel);
    
    // 인스턴스 모드: 메시들을 템플릿으로만 사용
    this.mesh = this.meshesToProcess[0] || clonedModel;
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
    this.setupInstances();
  }

  private setupInstances(): void {
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
    
    // 각 인스턴스에 대해 물리 바디 생성
    this.rockInstances.forEach((instance) => {
      // 리지드 바디 생성
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
      
      // 모든 메시 템플릿에 대해 충돌체 생성하여 복합 충돌체 구성
      this.meshesToProcess.forEach((template) => {
        const geometry = template.geometry;
        const vertices = geometry.attributes.position.array;
        const indices = geometry.index?.array;
        
        if (!vertices || vertices.length === 0) {
          console.warn('Empty geometry found, skipping mesh template');
          return;
        }
        
        // 메시의 로컬 변환을 고려한 정점 변환
        const meshMatrix = new THREE.Matrix4();
        meshMatrix.compose(template.position, template.quaternion, template.scale);
        
        // 인스턴스 스케일과 메시 변환을 모두 적용한 정점 생성
        const transformedVertices = new Float32Array(vertices.length);
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < vertices.length; i += 3) {
          vertex.set(vertices[i], vertices[i + 1], vertices[i + 2]);
          
          // 메시의 로컬 변환 적용
          vertex.applyMatrix4(meshMatrix);
          
          // 인스턴스 스케일 적용
          transformedVertices[i] = vertex.x * instance.scale.x;
          transformedVertices[i + 1] = vertex.y * instance.scale.y;
          transformedVertices[i + 2] = vertex.z * instance.scale.z;
        }
        
        // 충돌체 생성
        let colliderDesc: RAPIER.ColliderDesc | null = null;
        
        if (indices && indices.length > 0) {
          colliderDesc = RAPIER.ColliderDesc.trimesh(
            transformedVertices,
            new Uint32Array(indices)
          );
        } else {
          colliderDesc = RAPIER.ColliderDesc.convexHull(transformedVertices);
        }
        
        if (!colliderDesc) {
          console.warn('Failed to create collider for mesh template:', template.name);
          return;
        }
        
        // 동일한 리지드 바디에 충돌체 추가 (복합 충돌체)
        physics.world.createCollider(colliderDesc, rigidBody);
      });
      
      instance.rigidBody = rigidBody;
    });
  }

  private cleanupInstances(): void {
    if (!this.context) return;
    
    const { physics } = this.context;
    
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
    this.cleanupInstances();
    this.setupInstances();
  }

  protected async setupPhysics(): Promise<void> {
    // 빈 구현 - 실제 물리 설정은 onModelLoaded()에서 호출
    // BaseModel의 초기화 순서 때문에 여기서는 아무것도 하지 않음
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
    // 동적 물리 바디가 있는 인스턴스의 렌더링 동기화
    let hasUpdates = false;
    
    this.rockInstances.forEach((instance) => {
      if (instance.rigidBody && instance.rigidBody.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        const position = instance.rigidBody.translation();
        const rotation = instance.rigidBody.rotation();
        
        // 인스턴스 데이터 업데이트
        instance.position.set(position.x, position.y, position.z);
        instance.rotation.setFromQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w));
        
        // 변환 행렬 재계산
        instance.matrix.compose(
          instance.position,
          new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
          instance.scale
        );
        
        hasUpdates = true;
      }
    });
    
    // 동적 인스턴스가 있을 때만 렌더링 행렬 업데이트
    if (hasUpdates) {
      this.updateInstancedMeshMatrices();
    }
  }

  /**
   * TweakPane에서 호출되는 위치 업데이트 메서드
   */
  private updatePosition(options: PositionOptions): void {
    if (!this.modelGroup) return;
    
    // 기존 위치와의 차이 계산
    const deltaX = options.positionX - this.positionOptions.positionX;
    const deltaY = options.positionY - this.positionOptions.positionY;
    const deltaZ = options.positionZ - this.positionOptions.positionZ;
    
    this.positionOptions.positionX = options.positionX;
    this.positionOptions.positionY = options.positionY;
    this.positionOptions.positionZ = options.positionZ;
    
    this.modelGroup.position.x = options.positionX;
    this.modelGroup.position.y = options.positionY;
    this.modelGroup.position.z = options.positionZ;
    
    // 모든 인스턴스의 물리 바디 위치 업데이트
    this.rockInstances.forEach(instance => {
      if (instance.rigidBody) {
        const currentPos = instance.rigidBody.translation();
        instance.rigidBody.setTranslation({
          x: currentPos.x + deltaX,
          y: currentPos.y + deltaY,
          z: currentPos.z + deltaZ
        }, true);
        
        // 인스턴스 위치 데이터도 업데이트
        instance.position.x += deltaX;
        instance.position.y += deltaY;
        instance.position.z += deltaZ;
        
        // 변환 행렬 재계산
        instance.matrix.compose(
          instance.position, 
          new THREE.Quaternion().setFromEuler(instance.rotation), 
          instance.scale
        );
      }
    });
    
    // 렌더링 행렬 업데이트
    this.updateInstancedMeshMatrices();
  }

  /**
   * 인스턴스드 메시의 변환 행렬들을 업데이트
   */
  private updateInstancedMeshMatrices(): void {
    this.instancedMeshes.forEach(instancedMesh => {
      this.rockInstances.forEach((instance, index) => {
        instancedMesh.setMatrixAt(index, instance.matrix);
      });
      instancedMesh.instanceMatrix.needsUpdate = true;
    });
  }

  /**
   * 특정 바위 인스턴스를 동적으로 만들기
   */
  makeInstanceDynamic(instanceIndex: number): void {
    if (instanceIndex >= this.rockInstances.length) return;
    
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

  getRockInstances(): readonly RockInstance[] {
    return this.rockInstances;
  }

  dispose(): void {
    this.cleanupInstances();
    
    this.meshesToProcess = [];
    
    super.dispose();
  }
}

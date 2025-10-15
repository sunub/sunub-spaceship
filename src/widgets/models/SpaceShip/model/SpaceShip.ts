import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { TweakPane } from "@/widgets/TweakPane";
import { FlightController } from "@/widgets/controllers/FlightController";
import type { FlightActions } from "@/Inputs/types";
import { FlightActionMapper } from "@/Inputs/mappers/FlightActionMapper";
import { ServiceRegistry } from "@/core/ServiceRegistry";
import { BaseModel } from "../../BaseModel";

// Debug Modules
import { SpaceShipPhysicsDebugModule } from "../debug/SpaceShip.PhysicsDebug";
import { SpaceShipPositionDebugModule } from "../debug/SpaceShip.PositionDebug";
import { SpaceShipCameraDebugModule } from "../debug/SpaceShip.CameraDebug";
import { SpaceShipVisualDebugModule } from "../debug/SpaceShip.VisualDebug"; 

export class SpaceShip extends BaseModel {
  shipPivot: THREE.Object3D | null = null; // modelGroup 역할을 대신함
  private flightController: FlightController;
  private debugMode: boolean = false;
  
  private axesHelper: THREE.AxesHelper | null = null;
  private rollAxisHelper: THREE.ArrowHelper | null = null;
  private yawAxisHelper: THREE.ArrowHelper | null = null;
  private pitchAxisHelper: THREE.ArrowHelper | null = null;
  private showAxes: boolean = true;

  private physicsDebugModule: SpaceShipPhysicsDebugModule;
  private positionDebugModule: SpaceShipPositionDebugModule;
  private cameraDebugModule: SpaceShipCameraDebugModule;
  private visualDebugModule: SpaceShipVisualDebugModule;

  constructor() {
    super("spaceshipModel", new THREE.Vector3(0, 2, 0));
    
    this.flightController = new FlightController();
    this.physicsDebugModule = new SpaceShipPhysicsDebugModule(this.flightController);
    
    this.positionDebugModule = new SpaceShipPositionDebugModule(() => ({
      rigidBody: this.rigidBody,
      shipPivot: this.shipPivot,
      mesh: this.mesh
    }));
    
    this.cameraDebugModule = new SpaceShipCameraDebugModule();
    
    this.visualDebugModule = new SpaceShipVisualDebugModule(() => ({
      showAxes: this.showAxes,
      axesHelper: this.axesHelper,
      rollAxisHelper: this.rollAxisHelper,
      yawAxisHelper: this.yawAxisHelper,
      pitchAxisHelper: this.pitchAxisHelper,
      toggleAxesVisibility: () => {
        this.showAxes = !this.showAxes;
        this.toggleAxesVisibility();
      }
    }));

    this.setupTweakPane();
  }

  /**
   * BaseModel의 setupModelStructure를 오버라이드하여 
   * shipPivot 구조를 구현
   */
  protected setupModelStructure(clonedModel: THREE.Object3D): void {
    this.shipPivot = new THREE.Object3D();
    this.shipPivot.name = "ShipPivot";
    
    this.mesh = clonedModel;
    
    const box = new THREE.Box3().setFromObject(this.mesh);
    const centerOffset = box.getCenter(new THREE.Vector3());
    
    this.mesh.position.set(
      -centerOffset.x,
      -centerOffset.y,
      -centerOffset.z
    );
    
    this.shipPivot.add(this.mesh);
    this.shipPivot.rotateY(Math.PI / 2);
    this.modelGroup = this.shipPivot;
  }

  /**
   * ⚙️ SpaceShip 물리 설정
   * BaseModel의 setupPhysics를 오버라이드하여 
   * RAPIER 물리 엔진 설정
   */
  protected async setupPhysics(): Promise<void> {
    if (!this.context || !this.mesh || !this.shipPivot) return;
    
    const { physics } = this.context;
    
    const bounds = this.getModelBounds();
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setCanSleep(false)
      .setGravityScale(0) // 🌌 중력 영향 제거 (우주 환경)
      .setTranslation(this.position.x, this.position.y, this.position.z)
      .setRotation({
        x: this.shipPivot.quaternion.x,
        y: this.shipPivot.quaternion.y,
        z: this.shipPivot.quaternion.z,
        w: this.shipPivot.quaternion.w,
      })
      .setLinearDamping(0.8)
      .setAngularDamping(0.9);
      
    this.rigidBody = physics.world.createRigidBody(rigidBodyDesc);

    const shipColliderDesc = RAPIER.ColliderDesc.cuboid(
      bounds.size.x / 2,
      bounds.size.y / 2,
      bounds.size.z / 2
    );

    shipColliderDesc.setTranslation(0, 0, 0);
    
    shipColliderDesc.setMass(5.0);
    shipColliderDesc.setRestitution(0.1);
    shipColliderDesc.setFriction(0.5);
    
    physics.world.createCollider(shipColliderDesc, this.rigidBody);
  }

  /**
   * 🎯 모델 로드 완료 후 추가 설정
   * BaseModel의 onModelLoaded를 오버라이드
   */
  protected onModelLoaded(): void {
    if (!this.context) return;
    
    const bounds = this.getModelBounds();
    const boxSize = bounds.size.length();
    this.frameArea(boxSize * 0.5, boxSize, this.position, this.context.camera);
    
    this.createFlightAxes();
    this.setupInputListeners();
  }
  
  private setupTweakPane() {
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug');
    this.debugMode = debugParam === 'spaceship';
    if(!this.debugMode) {
      return;
    }

    const pane = TweakPane.getInstance();
    const f = pane.addFolder({
      title: "SpaceShip Debug Controls",
      expanded: true,
    });
    
    // 각 디버그 모듈에 위임
    this.physicsDebugModule.setupDebugControls(f);
    this.positionDebugModule.setupDebugControls(f);
    this.cameraDebugModule.setupDebugControls(f);
    this.visualDebugModule.setupDebugControls(f);
  }

  private setupInputListeners(): void {
    if (!this.context) return;
    
    this.context.inputManager.on('action.flight', (actions: FlightActions) => {
      this.handleFlightInput(actions);
    });
  }

  private handleFlightInput(actions: FlightActions): void {
    const hasInput = Math.abs(actions.movement.x) > 0.01 || Math.abs(actions.movement.y) > 0.01;
    
    if (hasInput && this.context) {
      // ServiceRegistry를 통해 Game 인스턴스에 접근
      // const game = ServiceRegistry.getInstance().get<any>('game');
      
      // if (game && typeof game.enableOrbitController === 'function') {
      //   game.enableOrbitController(false);
      // }
    }
  }

  update(deltaTime: number) {
    if (this.rigidBody && this.shipPivot && this.mesh && this.context) {
      const flightMapper = this.context.inputManager['actionMappers'].get('flight');
      if (flightMapper) {
        const currentActions = (flightMapper as FlightActionMapper).getCurrentActions();
        this.flightController.updateMovementInput(currentActions);
        this.flightController.handleMovement(this.rigidBody, deltaTime);
      }
      
      const position = this.rigidBody.translation();
      const rotation = this.rigidBody.rotation();

      this.shipPivot.position.set(position.x, position.y, position.z);
      this.shipPivot.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      
      this.updateFlightAxes();
      this.updateCameraTracking(deltaTime);
    }
  }

  private frameArea(
    _sizeToFitOnScreen: number,
    _boxSize: number,
    boxCenter: THREE.Vector3,
    camera: THREE.PerspectiveCamera
  ) {
    // 카메라 설정을 박스 중심을 향하도록 조정
    camera.updateProjectionMatrix();
    camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
  }

  /**
   * 🎯 항공기 축 시각화 생성
   * Roll (X축 - 빨강), Yaw (Y축 - 초록), Pitch (Z축 - 파랑)
   */
  private createFlightAxes(): void {
    if (!this.shipPivot) return;

    // 기본 좌표계 축 (작은 크기)
    this.axesHelper = new THREE.AxesHelper(0.5);
    this.shipPivot.add(this.axesHelper);

    // Roll 축 (X축 기준 회전) - 빨간색 화살표
    const rollDirection = new THREE.Vector3(1, 0, 0); // X축
    this.rollAxisHelper = new THREE.ArrowHelper(
      rollDirection, 
      new THREE.Vector3(0, 0, 0), 
      1.5, 
      0xff0000, // 빨간색
      0.3, 
      0.2
    );
    this.shipPivot.add(this.rollAxisHelper);

    // Yaw 축 (Y축 기준 회전) - 초록색 화살표  
    const yawDirection = new THREE.Vector3(0, 1, 0); // Y축
    this.yawAxisHelper = new THREE.ArrowHelper(
      yawDirection, 
      new THREE.Vector3(0, 0, 0), 
      1.5, 
      0x00ff00, // 초록색
      0.3, 
      0.2
    );
    this.shipPivot.add(this.yawAxisHelper);

    // Pitch 축 (Z축 기준 회전) - 파란색 화살표
    const pitchDirection = new THREE.Vector3(0, 0, 1); // Z축
    this.pitchAxisHelper = new THREE.ArrowHelper(
      pitchDirection, 
      new THREE.Vector3(0, 0, 0), 
      1.5, 
      0x0000ff, // 파란색
      0.3, 
      0.2
    );
    this.shipPivot.add(this.pitchAxisHelper);
  }

  private updateFlightAxes(): void {
    // 축들은 shipPivot의 자식이므로 자동으로 회전이 적용됩니다.
    // 추가적인 업데이트가 필요한 경우 여기에 구현
  }

  private updateCameraTracking(deltaTime: number): void {
    if (!this.context || !this.shipPivot) return;

    // OrbitController가 비활성화되어 있는지 확인
    const game = ServiceRegistry.getInstance().get<any>('game');
    const orbitController = game?.getOrbitController?.();
    
    // OrbitController가 활성화되어 있으면 추적하지 않음
    if (orbitController?.enabled) {
      return;
    }

    const camera = this.context.camera;
    const shipWorldPosition = new THREE.Vector3();
    this.shipPivot.getWorldPosition(shipWorldPosition);

    // 카메라가 우주선을 바라보도록 부드러운 추적
    const lerpFactor = Math.min(deltaTime * 2.0, 1.0); // 부드러운 추적 속도 (2.0은 추적 강도)
    
    // 현재 카메라가 바라보는 방향
    const currentTarget = new THREE.Vector3();
    camera.getWorldDirection(currentTarget);
    currentTarget.add(camera.position);

    // 새로운 타겟 (우주선 위치)
    const newTarget = shipWorldPosition.clone();

    // 부드럽게 interpolation
    const smoothTarget = currentTarget.lerp(newTarget, lerpFactor);
    
    // 카메라가 부드럽게 우주선을 추적
    camera.lookAt(smoothTarget);
    camera.updateProjectionMatrix();
  }

  private toggleAxesVisibility(): void {
    if (!this.axesHelper || !this.rollAxisHelper || !this.yawAxisHelper || !this.pitchAxisHelper) return;

    this.axesHelper.visible = this.showAxes;
    this.rollAxisHelper.visible = this.showAxes;
    this.yawAxisHelper.visible = this.showAxes;
    this.pitchAxisHelper.visible = this.showAxes;
  }

  dispose() {
    if (this.axesHelper) {
      this.shipPivot?.remove(this.axesHelper);
      this.axesHelper.dispose();
    }
    if (this.rollAxisHelper) {
      this.shipPivot?.remove(this.rollAxisHelper);
      this.rollAxisHelper.dispose();
    }
    if (this.yawAxisHelper) {
      this.shipPivot?.remove(this.yawAxisHelper);
      this.yawAxisHelper.dispose();
    }
    if (this.pitchAxisHelper) {
      this.shipPivot?.remove(this.pitchAxisHelper);
      this.pitchAxisHelper.dispose();
    }

    // BaseModel의 dispose 호출
    super.dispose();
  }
}

import { ColliderDesc, RigidBodyDesc, RigidBody } from "@dimforge/rapier3d-compat";
import {
    Box3,
    MathUtils,
    Mesh,
    Object3D,
    Quaternion,
    Vector2,
    Vector3,
} from "three/webgpu";
import { inject, injectable } from "inversify";
import { FlightController } from "@/Controllers/FlightController";
import { ResourceModel } from "../../ResourceModel";
import { SpaceShipPositionDebugModule } from "../debug/SpaceShip.PositionDebug";
import { SpaceShipVisualDebugModule } from "../debug/SpaceShip.VisualDebug";
import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { IResourceService } from "@/Services/IResouceService";
import type { ISceneManager } from "@/Services/ISceneManager";
import type { IPhysicsService } from "@/Services/IPhysicsService";
import { CollisionSensor } from "./CollisionSensor";
import type { Camera } from "@/Camera/instances/Camera";
import type Time from "@/utils/Time";
import type { EventBus } from "@/core/EventBus/EventBus";
import { GameEvents } from "@/core/EventBus/EventBusType";
import { EngineFlameFX } from "./EngineFlameFX";
import { SpaceShipCameraController } from "@/Controllers/SpaceShipCameraController";
import { SpaceShipAudioController } from "@/Controllers/SpaceShipAudioController";
import { SpaceShipInputHandler } from "@/Controllers/SpaceShipInputHandler";
import { SpaceShipAnimator } from "@/Controllers/SpaceShipAnimator";
import { SpaceShipDebugger } from "@/Controllers/SpaceShipDebugger";

@injectable()
export class SpaceShip extends ResourceModel {
    public shipPivot: Object3D | null = null;
    private visualPivot: Object3D | null = null;

    // Interpolation state
    private readonly prevPosition: Vector3 = new Vector3();
    private readonly prevRotation: Quaternion = new Quaternion();

    private readonly flightController: FlightController;
    private isLocked: boolean = true;

    // Banking Settings
    private maxBankingAngle: number = Math.PI / 4.5;
    private bankingLerpSpeed: number = 6.0;

    public readonly flightCameraOffset: Vector3 = new Vector3(8, 20, 10);

    // 디버그 모듈
    private readonly positionDebugModule: SpaceShipPositionDebugModule;
    private readonly visualDebugModule: SpaceShipVisualDebugModule;

    private readonly engineFlamesFX: EngineFlameFX;

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.PhysicsService)
        private readonly physicsService: IPhysicsService,
        @inject(GAME_CONTEXT.MODEL.CollisionSensor)
        private readonly sensor: CollisionSensor,
        @inject(GAME_CONTEXT.UTILITY.Time) private readonly time: Time,
        @inject(GAME_CONTEXT.CORE.Camera) private readonly camera: Camera,
        @inject(GAME_CONTEXT.CORE.EventBus) protected readonly eventBus: EventBus,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipCameraController)
        private readonly spaceShipCameraController: SpaceShipCameraController,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipAudioController)
        private readonly audioController: SpaceShipAudioController,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipInputHandler)
        private readonly inputHandler: SpaceShipInputHandler,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipAnimator)
        private readonly animator: SpaceShipAnimator,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipDebugger)
        private readonly shipDebugger: SpaceShipDebugger,
    ) {
        super(
            resourcesManager,
            sceneManager,
            "spaceshipModel",
            "",
            new Vector3(0, 1.15, 0),
        );
        this.engineFlamesFX = new EngineFlameFX(this.time, this.camera);

        this.flightController = new FlightController();

        this.sensor.setup({
            detectionRange: 0.5,
            halfExtents: { x: 0.15, y: 0.3, z: 0.5 },
            offset: { forward: 1.25, up: -0.5 },
        });

        this.positionDebugModule = new SpaceShipPositionDebugModule(() => ({
            rigidBody: this.rigidBody as RigidBody,
            shipPivot: this.shipPivot as Object3D,
            mesh: this.mesh as Object3D,
        }));

        this.visualDebugModule = new SpaceShipVisualDebugModule(() => ({
            showAxes: this.shipDebugger.debugMode,
            axesHelper: null,
            rollAxisHelper: null,
            yawAxisHelper: null,
            pitchAxisHelper: null,
            toggleAxesVisibility: () => this.shipDebugger.setDebugMode(!this.shipDebugger.debugMode),
        }));
    }

    protected override setupModelStructure(clonedModel: Object3D): void {
        this.shipPivot = new Object3D();
        this.shipPivot.name = "ShipPivot";
        this.visualPivot = new Object3D();
        this.visualPivot.name = "VisualPivot";
        this.mesh = clonedModel;

        const box = new Box3().setFromObject(this.mesh);
        const centerOffset = box.getCenter(new Vector3());

        this.mesh.position.set(
            -centerOffset.x,
            -centerOffset.y,
            -centerOffset.z,
        );
        this.mesh.scale.set(0.85, 0.85, 0.85);

        this.mesh.traverse((child) => {
            if (child instanceof Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.visualPivot.add(this.mesh);
        this.shipPivot.add(this.visualPivot);
        this.shipPivot.rotateY(Math.PI / 2);

        this.modelGroup = this.shipPivot;

        this.animator.initialize(this.visualPivot, this.maxBankingAngle);

        const sensorDebugMesh = this.sensor.initDebugMesh();
        this.shipDebugger.initialize(
            this.shipPivot,
            sensorDebugMesh,
            this.positionDebugModule,
            this.visualDebugModule
        );

        if (this.shipDebugger.debugNormalArrow) {
            this.sceneManager.add(this.shipDebugger.debugNormalArrow);
        }

        this.inputHandler.initialize(this.mesh, this.sceneManager);
    }

    protected override async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.mesh) {
            this.createPhysicsBody();
        }
    }

    private createPhysicsBody(): void {
        if (!this.shipPivot || !this.mesh) {
            return;
        }

        const rigidBodyDesc = RigidBodyDesc.dynamic()
            .setTranslation(this.position.x, this.position.y, this.position.z)
            .setRotation({
                x: this.shipPivot.quaternion.x,
                y: this.shipPivot.quaternion.y,
                z: this.shipPivot.quaternion.z,
                w: this.shipPivot.quaternion.w,
            })
            .setLinearDamping(10.5)
            .setAngularDamping(13.5)
            .setGravityScale(0);

        this.rigidBody = this.physicsService.createPhysicsBody(rigidBodyDesc);
        if (this.rigidBody) {
            this.rigidBody.setEnabledRotations(false, true, false, true);
        }

        const bounds = this.getModelBounds();
        const scaleFactor = 0.7;
        const scaleHeightFactor = 0.3;
        const shipColliderDesc = ColliderDesc.cuboid(
            (bounds.size.x / 2) * scaleFactor,
            (bounds.size.y / 2) * scaleHeightFactor,
            (bounds.size.z / 2) * scaleFactor,
        );

        shipColliderDesc.setTranslation(0, -0.5, 0);
        shipColliderDesc.setMass(5.0);
        shipColliderDesc.setRestitution(0.1);
        shipColliderDesc.setFriction(0.5);

        this.physicsService.createCollider(shipColliderDesc, this.rigidBody as RigidBody);

        this.prevPosition.copy(this.position);
        this.prevRotation.copy(this.shipPivot.quaternion);
    }

    protected override onModelLoaded(): void {
        if (this.visualPivot) {
            this.engineFlamesFX.initialize(this.visualPivot);
        }
        if (this.shipPivot) {
            this.spaceShipCameraController.setTarget(
                this.shipPivot,
                this.flightCameraOffset,
            );
        }
    }

    public updatePhysics(fixedDeltaTime: number): void {
        if (!this.rigidBody || !this.shipPivot) {
            return;
        }

        const pos = this.rigidBody.translation();
        const rot = this.rigidBody.rotation();
        this.prevPosition.set(pos.x, pos.y, pos.z);
        this.prevRotation.set(rot.x, rot.y, rot.z, rot.w);

        this.sensor.update(this.rigidBody, this.shipPivot, this.shipDebugger.debugMode);

        if (!this.isLocked) {
            this.flightController.handleMovement(
                this.rigidBody,
                fixedDeltaTime,
            );
        }
    }

    public override update(_: number, alpha: number = 0): void {
        if (!this.rigidBody || !this.shipPivot) {
            return;
        }

        const position = this.rigidBody.translation();
        const rotation = this.rigidBody.rotation();

        const currentPos = new Vector3(position.x, position.y, position.z);
        const currentRot = new Quaternion(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w,
        );

        this.shipPivot.position.lerpVectors(
            this.prevPosition,
            currentPos,
            alpha,
        );
        this.shipPivot.quaternion.slerpQuaternions(
            this.prevRotation,
            currentRot,
            alpha,
        );

        this.processInputAndVisuals();
        this.engineFlamesFX.update(this.flightController.getSmoothedThrust());
    }

    private processInputAndVisuals(): void {
        if (!this.rigidBody || !this.shipPivot || this.isLocked) return;

        const controlState = this.inputHandler.getControlState(
            this.time.delta,
            this.shipPivot.position
        );

        this.flightController.setBlocked(this.sensor.isObstacleDetected);

        const isKeyboardActive =
            Math.abs(controlState.thrust) > 0.1 || Math.abs(controlState.roll) > 0.1;

        if (isKeyboardActive) {
            this.flightController.updatePointerInput(new Vector2(0));
            const effectiveThrust =
                this.sensor.isObstacleDetected && controlState.thrust > 0
                    ? 0
                    : controlState.thrust;
            this.flightController.updateMovementInput(
                controlState.roll,
                effectiveThrust,
            );
        } else {
            const isThrustAllowed = !this.sensor.isObstacleDetected;
            this.flightController.updatePointerInput(
                controlState.pointerVector || new Vector2(0),
                isThrustAllowed,
            );
            this.flightController.updateMovementInput(0, 0);
        }

        this.animator.updateBanking(controlState.roll);

        this.eventBus.emit(GameEvents.KEYBOARD_INPUT, {
            roll: controlState.roll,
            thrust: controlState.thrust,
        });

        if (controlState.isActionActive) {
            this.audioController.updateEngineSound(true);
            this.spaceShipCameraController.ensureFollowMode();
        } else {
            this.audioController.updateEngineSound(false);
        }
    }

    public setMaxBankingAngle(angleDegrees: number): void {
        this.maxBankingAngle = MathUtils.degToRad(
            Math.max(0, Math.min(90, angleDegrees)),
        );
        this.animator.setMaxBankingAngle(this.maxBankingAngle);
    }

    public getMaxBankingAngle(): number {
        return MathUtils.radToDeg(this.maxBankingAngle);
    }

    public setBankingSpeed(speed: number): void {
        this.bankingLerpSpeed = Math.max(0.5, Math.min(20, speed));
    }

    public getBankingSpeed(): number {
        return this.bankingLerpSpeed;
    }

    public lock(): void {
        this.isLocked = true;
    }

    public unlock(): void {
        this.isLocked = false;
    }
}

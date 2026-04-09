import {
    ColliderDesc,
    type RigidBody,
    RigidBodyDesc,
} from "@dimforge/rapier3d-compat"
import { inject, injectable } from "inversify"
import { color, float, texture } from "three/tsl"
import {
    Box3,
    ClampToEdgeWrapping,
    MathUtils,
    Mesh,
    type MeshStandardMaterial,
    NearestFilter,
    Object3D,
    Quaternion,
    SRGBColorSpace,
    type Texture,
    Vector2,
    Vector3,
} from "three/webgpu"
import type { Camera } from "@/Camera/instances/Camera"
import { FlightController } from "@/Controllers/FlightController"
import type { SpaceShipAnimator } from "@/Controllers/SpaceShipAnimator"
import type { SpaceShipAudioController } from "@/Controllers/SpaceShipAudioController"
import type { SpaceShipCameraController } from "@/Controllers/SpaceShipCameraController"
import type { SpaceShipDebugger } from "@/Controllers/SpaceShipDebugger"
import type { SpaceShipInputHandler } from "@/Controllers/SpaceShipInputHandler"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import type Time from "@/utils/Time"
import { ResourceModel } from "../../ResourceModel"
import { SpaceShipPositionDebugModule } from "../debug/SpaceShip.PositionDebug"
import { SpaceShipVisualDebugModule } from "../debug/SpaceShip.VisualDebug"
import type { CollisionSensor } from "./CollisionSensor"
import { EngineFlameFX } from "./EngineFlameFX"

@injectable()
export class SpaceShip extends ResourceModel {
    public shipPivot: Object3D | null = null
    private visualPivot: Object3D | null = null
    private readonly materialCache = new Map<string, MeshDefaultMaterial>()

    // Interpolation state
    private readonly prevPosition: Vector3 = new Vector3()
    private readonly prevRotation: Quaternion = new Quaternion()
    private readonly currentPosition: Vector3 = new Vector3()
    private readonly currentRotation: Quaternion = new Quaternion()
    private readonly zeroVector2: Vector2 = new Vector2(0, 0)
    private readonly lastKeyboardState = { roll: 0, thrust: 0 }

    private readonly flightController: FlightController
    private isLocked: boolean = true

    // Banking Settings
    private maxBankingAngle: number = Math.PI / 4.5
    private bankingLerpSpeed: number = 6.0

    public readonly flightCameraOffset: Vector3 = new Vector3(8, 27.5, 10)

    // 디버그 모듈
    private readonly positionDebugModule: SpaceShipPositionDebugModule
    private readonly visualDebugModule: SpaceShipVisualDebugModule

    private readonly engineFlamesFX: EngineFlameFX

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
        @inject(GAME_CONTEXT.CORE.EventBus)
        protected readonly eventBus: EventBus,
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
        )
        this.engineFlamesFX = new EngineFlameFX(this.time, this.camera)

        this.flightController = new FlightController()

        this.sensor.setup({
            detectionRange: 0.5,
            halfExtents: { x: 0.15, y: 0.3, z: 0.5 },
            offset: { forward: 1.25, up: -0.5 },
        })

        this.positionDebugModule = new SpaceShipPositionDebugModule(() => ({
            rigidBody: this.rigidBody as RigidBody,
            shipPivot: this.shipPivot as Object3D,
            mesh: this.mesh as Object3D,
        }))

        this.visualDebugModule = new SpaceShipVisualDebugModule(() => ({
            showAxes: this.shipDebugger.debugMode,
            axesHelper: null,
            rollAxisHelper: null,
            yawAxisHelper: null,
            pitchAxisHelper: null,
            toggleAxesVisibility: () =>
                this.shipDebugger.setDebugMode(!this.shipDebugger.debugMode),
        }))
    }

    protected override setupModelStructure(clonedModel: Object3D): void {
        this.shipPivot = new Object3D()
        this.shipPivot.name = "ShipPivot"
        this.visualPivot = new Object3D()
        this.visualPivot.name = "VisualPivot"
        this.mesh = clonedModel

        const box = new Box3().setFromObject(this.mesh)
        const centerOffset = box.getCenter(new Vector3())

        this.mesh.position.set(
            -centerOffset.x,
            -centerOffset.y,
            -centerOffset.z,
        )
        this.mesh.scale.set(0.85, 0.85, 0.85)

        this.mesh.traverse((child) => {
            if (child instanceof Mesh) {
                const originalMaterial = child.material as MeshStandardMaterial
                const materialToApply =
                    this.getOptimizedMaterial(originalMaterial)
                const isEmissiveSurface =
                    this.isEmissiveSurface(originalMaterial)

                child.material = materialToApply
                child.castShadow = !isEmissiveSurface
                child.receiveShadow = false
            }
        })

        this.visualPivot.add(this.mesh)
        this.shipPivot.add(this.visualPivot)
        this.shipPivot.rotateY(Math.PI / 2)

        this.modelGroup = this.shipPivot

        this.animator.initialize(this.visualPivot, this.maxBankingAngle)

        const sensorDebugMesh = this.sensor.initDebugMesh()
        this.shipDebugger.initialize(
            this.shipPivot,
            sensorDebugMesh,
            this.positionDebugModule,
            this.visualDebugModule,
        )

        if (this.shipDebugger.debugNormalArrow) {
            this.sceneManager.add(this.shipDebugger.debugNormalArrow)
        }

        this.inputHandler.initialize(this.mesh, this.sceneManager)
    }

    private getOptimizedMaterial(
        material: MeshStandardMaterial,
    ): MeshDefaultMaterial {
        const cachedMaterial = this.materialCache.get(material.uuid)
        if (cachedMaterial) {
            return cachedMaterial
        }

        const materialParams: any = {
            // Preserve the authored face-culling setup. The ship uses thin-shell meshes.
            side: material.side,
            shadowSide: material.shadowSide ?? material.side,
            hasCoreShadows: true,
            hasDropShadows: false,
            hasLightBounce: false,
            // The spaceship uses many thin double-sided shell meshes.
            // Reorienting normals by frontFacing caused some shells to disappear.
            reorientDoubleSidedNormals: false,
        }

        if (material.map) {
            this.optimizeTextureForMobile(material.map)
            const colorNode = texture(material.map)
            materialParams.colorNode = material.color
                ? colorNode.mul(color(material.color))
                : colorNode
        } else if (material.color) {
            materialParams.colorNode = color(material.color)
        }

        if (material.transparent || material.opacity < 1) {
            materialParams.transparent = true
            materialParams.alphaNode = float(material.opacity)
            materialParams.depthWrite = false
        }

        if (material.alphaTest > 0) {
            materialParams.alphaTest = material.alphaTest
        }

        const emissiveNode = this.createEmissiveNode(material)
        if (emissiveNode) {
            materialParams.emissionNode = emissiveNode
            materialParams.hasCoreShadows = false
        }

        const optimizedMaterial = new MeshDefaultMaterial(materialParams)
        this.materialCache.set(material.uuid, optimizedMaterial)
        return optimizedMaterial
    }

    private createEmissiveNode(material: MeshStandardMaterial) {
        const hasEmissiveColor =
            material.emissive.getHex() !== 0 && material.emissiveIntensity > 0

        if (material.emissiveMap) {
            this.optimizeTextureForMobile(material.emissiveMap)
            let emissionNode: any = texture(material.emissiveMap)

            if (hasEmissiveColor) {
                emissionNode = emissionNode.mul(color(material.emissive))
            }

            if (material.emissiveIntensity !== 1) {
                emissionNode = emissionNode.mul(
                    float(material.emissiveIntensity),
                )
            }

            return emissionNode
        }

        if (!hasEmissiveColor) {
            return null
        }

        return color(material.emissive).mul(float(material.emissiveIntensity))
    }

    private optimizeTextureForMobile(textureMap: Texture): void {
        textureMap.wrapS = ClampToEdgeWrapping
        textureMap.wrapT = ClampToEdgeWrapping
        textureMap.minFilter = NearestFilter
        textureMap.magFilter = NearestFilter
        textureMap.generateMipmaps = false
        textureMap.colorSpace = SRGBColorSpace
        textureMap.needsUpdate = true
    }

    private isEmissiveSurface(material: MeshStandardMaterial): boolean {
        const materialName = material.name.toLowerCase()
        const hasEmissiveColor =
            material.emissive.getHex() !== 0 && material.emissiveIntensity > 0

        return Boolean(
            material.emissiveMap ||
                hasEmissiveColor ||
                materialName.includes("light"),
        )
    }

    protected override async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.mesh) {
            this.createPhysicsBody()
        }
    }

    private createPhysicsBody(): void {
        if (!this.shipPivot || !this.mesh) {
            return
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
            .setGravityScale(0)

        this.rigidBody = this.physicsService.createPhysicsBody(rigidBodyDesc)
        if (this.rigidBody) {
            this.rigidBody.setEnabledRotations(false, true, false, true)
        }

        const bounds = this.getModelBounds()
        const scaleFactor = 0.7
        const scaleHeightFactor = 0.3
        const shipColliderDesc = ColliderDesc.cuboid(
            (bounds.size.x / 2) * scaleFactor,
            (bounds.size.y / 2) * scaleHeightFactor,
            (bounds.size.z / 2) * scaleFactor,
        )

        shipColliderDesc.setTranslation(0, -0.5, 0)
        shipColliderDesc.setMass(5.0)
        shipColliderDesc.setRestitution(0.1)
        shipColliderDesc.setFriction(0.5)

        this.physicsService.createCollider(
            shipColliderDesc,
            this.rigidBody as RigidBody,
        )

        this.prevPosition.copy(this.position)
        this.prevRotation.copy(this.shipPivot.quaternion)
    }

    protected override onModelLoaded(): void {
        if (this.visualPivot) {
            this.engineFlamesFX.initialize(this.visualPivot)
        }
        if (this.shipPivot) {
            this.spaceShipCameraController.setTarget(
                this.shipPivot,
                this.flightCameraOffset,
            )
        }
    }

    public updatePhysics(fixedDeltaTime: number): void {
        if (!this.rigidBody || !this.shipPivot) {
            return
        }

        const pos = this.rigidBody.translation()
        const rot = this.rigidBody.rotation()
        this.prevPosition.set(pos.x, pos.y, pos.z)
        this.prevRotation.set(rot.x, rot.y, rot.z, rot.w)

        this.sensor.update(
            this.rigidBody,
            this.shipPivot,
            this.shipDebugger.debugMode,
        )

        if (!this.isLocked) {
            this.flightController.handleMovement(this.rigidBody, fixedDeltaTime)
        }
    }

    public override update(_: number, alpha: number = 0): void {
        if (!this.rigidBody || !this.shipPivot) {
            return
        }

        const position = this.rigidBody.translation()
        const rotation = this.rigidBody.rotation()

        this.currentPosition.set(position.x, position.y, position.z)
        this.currentRotation.set(rotation.x, rotation.y, rotation.z, rotation.w)

        this.shipPivot.position.lerpVectors(
            this.prevPosition,
            this.currentPosition,
            alpha,
        )
        this.shipPivot.quaternion.slerpQuaternions(
            this.prevRotation,
            this.currentRotation,
            alpha,
        )

        this.processInputAndVisuals()
        this.engineFlamesFX.update(this.flightController.getSmoothedThrust())
    }

    private processInputAndVisuals(): void {
        if (!this.rigidBody || !this.shipPivot || this.isLocked) return

        const controlState = this.inputHandler.getControlState(
            this.time.delta,
            this.shipPivot.position,
        )

        this.flightController.setBlocked(this.sensor.isObstacleDetected)

        const isKeyboardActive =
            Math.abs(controlState.thrust) > 0.1 ||
            Math.abs(controlState.roll) > 0.1

        if (isKeyboardActive) {
            this.flightController.updatePointerInput(this.zeroVector2)
            const effectiveThrust =
                this.sensor.isObstacleDetected && controlState.thrust > 0
                    ? 0
                    : controlState.thrust
            this.flightController.updateMovementInput(
                controlState.roll,
                effectiveThrust,
            )
        } else {
            const isThrustAllowed = !this.sensor.isObstacleDetected
            this.flightController.updatePointerInput(
                controlState.pointerVector || this.zeroVector2,
                isThrustAllowed,
            )
            this.flightController.updateMovementInput(0, 0)
        }

        this.animator.updateBanking(
            controlState.roll,
            this.time.delta * 0.001,
            this.bankingLerpSpeed,
        )

        this.emitKeyboardStateIfChanged(controlState.roll, controlState.thrust)

        if (controlState.isActionActive) {
            this.audioController.updateEngineSound(true)
            this.spaceShipCameraController.ensureFollowMode()
        } else {
            this.audioController.updateEngineSound(false)
        }
    }

    private emitKeyboardStateIfChanged(roll: number, thrust: number): void {
        const normalizedRoll = roll < -0.1 ? -1 : roll > 0.1 ? 1 : 0
        const normalizedThrust = thrust < -0.1 ? -1 : thrust > 0.1 ? 1 : 0

        if (
            normalizedRoll === this.lastKeyboardState.roll &&
            normalizedThrust === this.lastKeyboardState.thrust
        ) {
            return
        }

        this.lastKeyboardState.roll = normalizedRoll
        this.lastKeyboardState.thrust = normalizedThrust

        this.eventBus.emit(GameEvents.KEYBOARD_INPUT, {
            roll: normalizedRoll,
            thrust: normalizedThrust,
        })
    }

    public setMaxBankingAngle(angleDegrees: number): void {
        this.maxBankingAngle = MathUtils.degToRad(
            Math.max(0, Math.min(90, angleDegrees)),
        )
        this.animator.setMaxBankingAngle(this.maxBankingAngle)
    }

    public getMaxBankingAngle(): number {
        return MathUtils.radToDeg(this.maxBankingAngle)
    }

    public setBankingSpeed(speed: number): void {
        this.bankingLerpSpeed = Math.max(0.5, Math.min(20, speed))
    }

    public getBankingSpeed(): number {
        return this.bankingLerpSpeed
    }

    public lock(): void {
        this.isLocked = true
        this.emitKeyboardStateIfChanged(0, 0)
    }

    public unlock(): void {
        this.isLocked = false
    }

    public override dispose(): void {
        this.materialCache.forEach((material) => {
            material.dispose()
        })
        this.materialCache.clear()
        super.dispose()
    }
}

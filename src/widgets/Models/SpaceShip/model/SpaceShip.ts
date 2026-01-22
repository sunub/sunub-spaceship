import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import gsap from "gsap"
import {
    ArrowHelper,
    AxesHelper,
    Box3,
    MathUtils,
    Mesh,
    Object3D,
    Vector2,
    Vector3,
} from "three/webgpu"
import { FlightController } from "@/widgets/controllers/FlightController"
import { TweakPane } from "@/widgets/TweakPane"
import { BaseModel } from "../../BaseModel"
import { EngineFlame } from "../../EngineFlame"
import { SpaceShipCameraDebugModule } from "../debug/SpaceShip.CameraDebug"
import { SpaceShipPositionDebugModule } from "../debug/SpaceShip.PositionDebug"
import { SpaceShipVisualDebugModule } from "../debug/SpaceShip.VisualDebug"
import { JoyStick } from "./JoyStick"

export class SpaceShip extends BaseModel {
    shipPivot: Object3D | null = null // 물리 엔진과 연결된 메인 컨테이너
    private visualPivot: Object3D | null = null // 시각적 효과용 중간 컨테이너
    private flightController: FlightController
    private debugMode: boolean = false
    private engineFlames: EngineFlame[] = [] // Array for multiple flames

    // 불꽃 성장 설정
    private currentFlameLength: number = 0.1
    private maxFlameLength: number = 1.5
    private flameGrowthSpeed: number = 1.0 // 초당 성장 속도
    private flameShrinkSpeed: number = 1.2 // 초당 감소 속도

    // 뱅킹(Banking) 효과 설정 - 간단한 지수 감쇠 방식
    private maxBankingAngle: number = Math.PI / 4.5 // 40도 (라디안) - 적절한 기울기
    private currentBankingAngle: number = 0 // 현재 기울기 각도

    // 간단한 보간 설정
    private bankingLerpSpeed: number = 6.0 // 기울기 변화 속도 (부드러운 보간)

    private axesHelper: AxesHelper | null = null
    private rollAxisHelper: ArrowHelper | null = null
    private yawAxisHelper: ArrowHelper | null = null
    private pitchAxisHelper: ArrowHelper | null = null
    private showAxes: boolean = true

    private positionDebugModule: SpaceShipPositionDebugModule
    private cameraDebugModule: SpaceShipCameraDebugModule
    private visualDebugModule: SpaceShipVisualDebugModule
    private joyStick: JoyStick
    private isLocked: boolean = true

    public readonly flightCameraOffset = new Vector3(8, 20, 10)

    constructor() {
        super("spaceshipModel", new Vector3(0, 1.15, 0))
        this.joyStick = new JoyStick()

        const positions = [
            new Vector3(-1.1, -0.15, -0.15),
            new Vector3(-1.1, -0.15, 0.175),
        ]

        positions.forEach((pos) => {
            const flame = new EngineFlame(pos)
            flame.modelGroup.rotateZ(1.55) // Apply the rotation here
            this.engineFlames.push(flame)
        })

        this.flightController = new FlightController()

        this.positionDebugModule = new SpaceShipPositionDebugModule(() => ({
            rigidBody: this.rigidBody,
            shipPivot: this.shipPivot,
            mesh: this.mesh,
        }))

        this.cameraDebugModule = new SpaceShipCameraDebugModule()

        this.visualDebugModule = new SpaceShipVisualDebugModule(() => ({
            showAxes: this.showAxes,
            axesHelper: this.axesHelper,
            rollAxisHelper: this.rollAxisHelper,
            yawAxisHelper: this.yawAxisHelper,
            pitchAxisHelper: this.pitchAxisHelper,
            toggleAxesVisibility: () => {
                this.showAxes = !this.showAxes
                this.toggleAxesVisibility()
            },
        }))

        this.setupTweakPane()
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        // 물리 엔진과 연결된 메인 컨테이너
        this.shipPivot = new Object3D()
        this.shipPivot.name = "ShipPivot"

        // 시각적 효과용 중간 컨테이너 (뱅킹 효과 담당)
        this.visualPivot = new Object3D()
        this.visualPivot.name = "VisualPivot"

        // 실제 3D 모델
        this.mesh = clonedModel

        // 모델 중심점 맞추기
        const box = new Box3().setFromObject(this.mesh)
        const centerOffset = box.getCenter(new Vector3())

        this.mesh.position.set(
            -centerOffset.x,
            -centerOffset.y,
            -centerOffset.z,
        )

        // Enable shadows
        this.mesh.traverse((child) => {
            if (child instanceof Mesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        // 🏗️ 계층 구조 구성: shipPivot -> visualPivot -> mesh
        this.visualPivot.add(this.mesh)
        this.engineFlames.forEach((flame) => {
            if (!this.visualPivot) {
                return
            }
            this.visualPivot.add(flame.modelGroup)
        })

        this.shipPivot.add(this.visualPivot)
        this.shipPivot.rotateY(Math.PI / 2)

        // 씬에 추가
        if (this.context) {
            this.context.scene.add(this.shipPivot)
        }

        this.joyStick.drawJoyStick(this.context, this.mesh)
    }

    /**
     * 🏗️ 물리 엔진 설정
     * BaseModel의 setupPhysics를 오버라이드
     */
    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.context?.physics && this.mesh) {
            this.createPhysicsBody(this.context.physics)
        }
    }

    private createPhysicsBody(physics: any): void {
        if (!this.shipPivot || !this.mesh) return

        const bounds = this.getModelBounds()
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

        this.rigidBody = physics.world.createRigidBody(rigidBodyDesc)
        if (this.rigidBody) {
            this.rigidBody.setEnabledRotations(false, true, false, true)
        }

        const shipColliderDesc = ColliderDesc.cuboid(
            bounds.size.x / 2,
            bounds.size.y / 2,
            bounds.size.z / 2,
        )

        shipColliderDesc.setTranslation(0, 0, 0)

        shipColliderDesc.setMass(5.0)
        shipColliderDesc.setRestitution(0.1)
        shipColliderDesc.setFriction(0.5)

        physics.world.createCollider(shipColliderDesc, this.rigidBody)
    }

    /**
     * 🎯 모델 로드 완료 후 추가 설정
     * BaseModel의 onModelLoaded를 오버라이드
     */
    protected async onModelLoaded(): Promise<void> {
        if (!this.context) return

        // Initialize EngineFlames
        for (const flame of this.engineFlames) {
            await flame.initialize(this.context)
            // Ensure attached to visualPivot (safety check against scene add)
            this.visualPivot?.add(flame.modelGroup)
        }

        this.createFlightAxes()
    }

    private setupTweakPane() {
        const urlParams = new URLSearchParams(window.location.search)
        const debugParam = urlParams.get("debug")
        this.debugMode = debugParam === "spaceship"
        if (!this.debugMode) {
            return
        }

        const pane = TweakPane.getInstance()
        const f = pane.addFolder({
            title: "SpaceShip Debug Controls",
            expanded: true,
        })

        // 각 디버그 모듈에 위임
        this.positionDebugModule.setupDebugControls(f)
        this.cameraDebugModule.setupDebugControls(f)
        this.visualDebugModule.setupDebugControls(f)
    }

    public setupInputListeners(): void {
        // const domElement = this.context.domElement
        // domElement.addEventListener(
        //     "pointerdown",
        //     (event: PointerEvent) => {
        //         if (!this.context) {
        //             return
        //         }
        //         if (event.button === 0 || event.button === 1) {
        //             if (this.context.camera.orbitControls) {
        //                 if (!this.shipPivot) {
        //                     return
        //                 }
        //                 const targetPos = this.shipPivot.getWorldPosition(
        //                     new Vector3(),
        //                 )
        //                 this.context.camera.orbitControls.target.copy(targetPos)
        //                 this.context.camera.orbitControls.update()
        //                 this.context.camera.orbitControls.enabled = true
        //                 this.context.camera.mode = "orbit"
        //             }
        //             this.context.camera.setFollowTargetObject(null)
        //         }
        //     },
        //     { capture: true },
        // )
    }

    private updateControlIndicators(roll: number, thrust: number): void {
        const keyW = document.getElementById("key-w")
        const keyA = document.getElementById("key-a")
        const keyS = document.getElementById("key-s")
        const keyD = document.getElementById("key-d")

        if (keyW) {
            keyW.classList.toggle("active", thrust > 0.1)
        }
        if (keyA) {
            keyA.classList.toggle("active", roll < -0.1)
        }
        if (keyS) {
            keyS.classList.toggle("active", thrust < -0.1)
        }
        if (keyD) {
            keyD.classList.toggle("active", roll > 0.1)
        }
    }

    private createFlightAxes(): void {
        if (!this.visualPivot) return

        // 기본 좌표계 축 (작은 크기)
        this.axesHelper = new AxesHelper(0.5)
        this.visualPivot.add(this.axesHelper)

        // Roll 축 (X축 기준 회전) - 빨간색 화살표
        const rollDirection = new Vector3(1, 0, 0) // X축
        this.rollAxisHelper = new ArrowHelper(
            rollDirection,
            new Vector3(0, 0, 0),
            1.5,
            0xff0000, // 빨간색
            0.3,
            0.2,
        )
        this.visualPivot.add(this.rollAxisHelper)

        // Yaw 축 (Y축 기준 회전) - 초록색 화살표
        const yawDirection = new Vector3(0, 1, 0) // Y축
        this.yawAxisHelper = new ArrowHelper(
            yawDirection,
            new Vector3(0, 0, 0),
            1.5,
            0x00ff00, // 초록색
            0.3,
            0.2,
        )
        this.visualPivot.add(this.yawAxisHelper)

        // Pitch 축 (Z축 기준 회전) - 파란색 화살표
        const pitchDirection = new Vector3(0, 0, 1) // Z축
        this.pitchAxisHelper = new ArrowHelper(
            pitchDirection,
            new Vector3(0, 0, 0),
            1.5,
            0x0000ff, // 파란색
            0.3,
            0.2,
        )
        this.visualPivot.add(this.pitchAxisHelper)
    }

    private updateCameraTracking(): void {
        if (!this.context || !this.shipPivot) {
            return
        }
        this.context.camera.setFollowTargetObject(
            this.shipPivot,
            this.flightCameraOffset,
            0.12,
        )
    }

    private toggleAxesVisibility(): void {
        if (
            !this.axesHelper ||
            !this.rollAxisHelper ||
            !this.yawAxisHelper ||
            !this.pitchAxisHelper
        )
            return

        this.axesHelper.visible = this.showAxes
        this.rollAxisHelper.visible = this.showAxes
        this.yawAxisHelper.visible = this.showAxes
        this.pitchAxisHelper.visible = this.showAxes
    }

    /**
     * 🎯 뱅킹 효과 처리: A/D 키 입력에 따른 목표 기울기 설정
     * @param rollInput A/D 키 입력값 (-1: A키/왼쪽, 1: D키/오른쪽)
     */
    private updateBankingEffect(rollInput: number): void {
        if (!this.visualPivot) return

        let targetAngle =
            Math.abs(rollInput) > 0.01 ? rollInput * this.maxBankingAngle : 0

        targetAngle = Math.max(
            -this.maxBankingAngle,
            Math.min(this.maxBankingAngle, targetAngle),
        )

        gsap.to(this.visualPivot.rotation, {
            x: targetAngle,
            duration: 0.8, // 반응 속도 조절 (초 단위)
            ease: "power2.out", // 부드러운 감속 효과
            overwrite: true, // 이전 애니메이션을 덮어쓰고 새로운 목표로 즉시 전환
        })
    }

    setMaxBankingAngle(angleDegrees: number): void {
        this.maxBankingAngle = MathUtils.degToRad(
            Math.max(0, Math.min(90, angleDegrees)),
        )
    }

    getMaxBankingAngle(): number {
        return MathUtils.radToDeg(this.maxBankingAngle)
    }

    setBankingSpeed(speed: number): void {
        this.bankingLerpSpeed = Math.max(0.5, Math.min(20, speed))
    }

    getBankingSpeed(): number {
        return this.bankingLerpSpeed
    }

    getCurrentBankingAngle(): number {
        return MathUtils.radToDeg(this.currentBankingAngle)
    }

    public unlock() {
        this.isLocked = false
    }

    public update(deltaTime: number) {
        if (!this.rigidBody || !this.shipPivot || !this.context) {
            return
        }

        const position = this.rigidBody.translation()
        const rotation = this.rigidBody.rotation()

        this.shipPivot.position.set(position.x, position.y, position.z)
        this.shipPivot.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w,
        )

        this.updateCameraTracking()
        this.updateFlightController(deltaTime)
    }

    private updateFlightController(deltaTime: number) {
        if (
            !this.rigidBody ||
            !this.shipPivot ||
            !this.context ||
            this.isLocked
        ) {
            return
        }

        this.joyStick.update(deltaTime, this.context, this.shipPivot.position)

        const input = this.context.inputManager
        const thrustInput =
            (input.isAction("MoveForward") ? 1 : 0) +
            (input.isAction("MoveBackward") ? -1 : 0)
        const rollInput =
            (input.isAction("TurnLeft") ? -1 : 0) +
            (input.isAction("TurnRight") ? 1 : 0)

        const isKeyboardActive =
            Math.abs(thrustInput) > 0.1 || Math.abs(rollInput) > 0.1
        if (isKeyboardActive) {
            this.flightController.updatePointerInput(new Vector2(0))
            this.flightController.updateMovementInput(rollInput, thrustInput)
        } else {
            this.flightController.updatePointerInput(this.joyStick.outputVector)
            this.flightController.updateMovementInput(0, 0)
        }

        this.flightController.handleMovement(this.rigidBody)

        this.updateBankingEffect(rollInput)
        this.updateControlIndicators(rollInput, thrustInput)

        if (
            Math.abs(thrustInput) > 0 ||
            Math.abs(rollInput) > 0 ||
            this.flightController.pointerVector !== null
        ) {
            if (!this.context.audio.isPlaying("engine")) {
                this.context.audio.play("engine")
            }

            if (this.context.camera.mode !== "follow") {
                this.context.camera.setFollowTargetObject(
                    this.shipPivot,
                    this.flightCameraOffset,
                    0.12,
                )
                this.context.camera.mode = "follow"
                if (this.context.camera.orbitControls) {
                    this.context.camera.orbitControls.enabled = false
                }
            }
        } else {
            if (this.context.audio.isPlaying("engine")) {
                this.context.audio.stop("engine")
            }
        }

        const thrustLevel = this.flightController.getSmoothedThrust()
        const absThrust = Math.abs(thrustLevel)
        if (absThrust > 0.05) {
            this.currentFlameLength = Math.min(
                this.maxFlameLength,
                this.currentFlameLength + this.flameGrowthSpeed * deltaTime,
            )
        } else {
            this.currentFlameLength = Math.max(
                0.1,
                this.currentFlameLength - this.flameShrinkSpeed * deltaTime,
            )
        }

        this.engineFlames.forEach((flame) => {
            flame.setThrust(absThrust)
            flame.setFlameLength(this.currentFlameLength) // 성장한 길이 적용
            flame.update(deltaTime)
        })
    }
}

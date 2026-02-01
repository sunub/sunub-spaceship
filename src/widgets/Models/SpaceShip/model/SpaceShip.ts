import { ColliderDesc, Cuboid, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import gsap from "gsap"
import {
    ArrowHelper,
    AxesHelper,
    Box3,
    BoxGeometry,
    Group,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    Quaternion,
    Vector2,
    Vector3,
} from "three/webgpu"
import { FlightController } from "@/widgets/controllers/FlightController"
import { JoyStick } from "@/widgets/controllers/JoyStick"
import { TweakPane } from "@/widgets/TweakPane"
import { BaseModel } from "../../BaseModel"
import { EngineFlame } from "../../EngineFlame"
import { SpaceShipCameraDebugModule } from "../debug/SpaceShip.CameraDebug"
import { SpaceShipPositionDebugModule } from "../debug/SpaceShip.PositionDebug"
import { SpaceShipVisualDebugModule } from "../debug/SpaceShip.VisualDebug"

export class SpaceShip extends BaseModel {
    // ─────────────────────────────────────────────────────────────────────────────
    // 📦 CORE COMPONENTS
    // ─────────────────────────────────────────────────────────────────────────────
    shipPivot: Object3D | null = null
    private visualPivot: Object3D | null = null
    private flightController: FlightController
    public joyStick: JoyStick
    private engineFlames: EngineFlame[] = []

    // ─────────────────────────────────────────────────────────────────────────────
    // ⚙️ SETTINGS & STATE
    // ─────────────────────────────────────────────────────────────────────────────
    private isLocked: boolean = true

    // Flame Settings
    private currentFlameLength: number = 0.1
    private maxFlameLength: number = 1.5
    private flameGrowthSpeed: number = 1.0
    private flameShrinkSpeed: number = 1.2

    // Banking Settings
    private maxBankingAngle: number = Math.PI / 4.5
    private currentBankingAngle: number = 0
    private bankingLerpSpeed: number = 6.0

    public readonly flightCameraOffset = new Vector3(8, 20, 10)

    // ─────────────────────────────────────────────────────────────────────────────
    // 🛠️ DEBUG SYSTEM & SHAPECAST
    // ─────────────────────────────────────────────────────────────────────────────
    private debugMode: boolean = false // 마스터 스위치

    // 디버그 객체 관리용 그룹 (한 번에 Show/Hide)
    private debugGroup: Group = new Group()
    private debugCastMesh: Mesh | null = null

    // [수정] VisualDebugContext 인터페이스 충족을 위한 개별 헬퍼들
    private axesHelper: AxesHelper | null = null
    private rollAxisHelper: ArrowHelper | null = null
    private yawAxisHelper: ArrowHelper | null = null
    private pitchAxisHelper: ArrowHelper | null = null

    private debugNormalArrow: ArrowHelper | null = null // Scene에 직접 붙는 예외 객체

    // 디버그 모듈
    private positionDebugModule: SpaceShipPositionDebugModule
    private cameraDebugModule: SpaceShipCameraDebugModule
    private visualDebugModule: SpaceShipVisualDebugModule

    // Shapecast 설정
    private detectionRange = 0.5
    private isObstacle = false
    private castShapeHalfExtents = { x: 0.15, y: 0.3, z: 0.5 }
    private shapecastOffset = { forward: 1.25, up: -0.5 }

    // 디버그 색상 상수
    private readonly COLOR_SAFE = 0x0000ff
    private readonly COLOR_HIT = 0xff0000

    constructor() {
        super("spaceshipModel", new Vector3(0, 1.15, 0))

        // Joystick 초기화
        this.joyStick = new JoyStick()

        // 엔진 불꽃 위치 설정
        const positions = [
            new Vector3(-1.1, -0.15, -0.15),
            new Vector3(-1.1, -0.15, 0.175),
        ]
        positions.forEach((pos) => {
            const flame = new EngineFlame(pos)
            flame.modelGroup.rotateZ(1.55)
            this.engineFlames.push(flame)
        })

        this.flightController = new FlightController()

        // 디버그 모듈 초기화
        this.positionDebugModule = new SpaceShipPositionDebugModule(() => ({
            rigidBody: this.rigidBody,
            shipPivot: this.shipPivot,
            mesh: this.mesh,
        }))

        this.cameraDebugModule = new SpaceShipCameraDebugModule()

        // [수정] VisualDebugModule에 필요한 모든 속성 전달
        this.visualDebugModule = new SpaceShipVisualDebugModule(() => ({
            showAxes: this.debugMode,
            axesHelper: this.axesHelper,
            rollAxisHelper: this.rollAxisHelper,
            yawAxisHelper: this.yawAxisHelper,
            pitchAxisHelper: this.pitchAxisHelper,
            toggleAxesVisibility: () => this.setDebugMode(!this.debugMode),
        }))

        // TweakPane 설정 (URL 파라미터 체크)
        this.setupTweakPane()
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.shipPivot = new Object3D()
        this.shipPivot.name = "ShipPivot"
        this.visualPivot = new Object3D()
        this.visualPivot.name = "VisualPivot"
        this.mesh = clonedModel

        // 모델 바운딩 박스 및 센터링
        const box = new Box3().setFromObject(this.mesh)
        const centerOffset = box.getCenter(new Vector3())

        this.mesh.position.set(
            -centerOffset.x,
            -centerOffset.y,
            -centerOffset.z,
        )
        this.mesh.scale.set(0.85, 0.85, 0.85)

        // 그림자 설정
        this.mesh.traverse((child) => {
            if (child instanceof Mesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        // 계층 구조 조립
        this.visualPivot.add(this.mesh)
        this.engineFlames.forEach((flame) => {
            if (!this.visualPivot) return
            this.visualPivot.add(flame.modelGroup)
        })

        this.shipPivot.add(this.visualPivot)
        this.shipPivot.rotateY(Math.PI / 2)

        // ✨ 디버그 그룹을 Pivot에 추가 (함선과 함께 이동)
        this.shipPivot.add(this.debugGroup)
        this.debugGroup.name = "DebugVisuals"
        // 초기에는 숨김 처리
        this.debugGroup.visible = false

        if (this.context) {
            this.context.scene.add(this.shipPivot)
        }

        this.joyStick.drawJoyStick(this.context, this.mesh)

        // ✨ 디버그 비주얼 객체 생성
        this.initDebugVisuals()
    }

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.context?.physics && this.mesh) {
            this.createPhysicsBody(this.context.physics)
        }
    }

    private createPhysicsBody(physics: any): void {
        if (!this.shipPivot || !this.mesh) return

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

        physics.world.createCollider(shipColliderDesc, this.rigidBody)
    }

    protected async onModelLoaded(): Promise<void> {
        if (!this.context) return
        for (const flame of this.engineFlames) {
            await flame.initialize(this.context)
            this.visualPivot?.add(flame.modelGroup)
        }

        // this.setupInputListeners()

        // 로드 완료 후 현재 디버그 모드 상태 적용
        this.setDebugMode(this.debugMode)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 🛠️ DEBUG METHODS (Unified)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * 디버깅용 3D 객체(박스, 축 등)를 생성하여 메모리에 올립니다.
     */
    private initDebugVisuals() {
        // 1. Shapecast 범위 박스
        const geometry = new BoxGeometry(
            this.castShapeHalfExtents.x * 2,
            this.castShapeHalfExtents.y * 2,
            this.castShapeHalfExtents.z * 2,
        )
        const material = new MeshBasicMaterial({
            color: this.COLOR_SAFE,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
        })

        this.debugCastMesh = new Mesh(geometry, material)
        this.debugCastMesh.name = "DebugShapecastBox"
        this.debugCastMesh.position.set(
            this.shapecastOffset.forward,
            this.shapecastOffset.up,
            0,
        )
        this.debugGroup.add(this.debugCastMesh)

        // 2. 축 헬퍼 (Axes Helper)
        this.axesHelper = new AxesHelper(1.5)
        this.debugGroup.add(this.axesHelper)

        // [수정] 3. 개별 축 헬퍼 (VisualDebugContext 요구사항)
        this.rollAxisHelper = new ArrowHelper(
            new Vector3(1, 0, 0),
            new Vector3(0, 0, 0),
            1.5,
            0xff0000,
        ) // Red (X)
        this.yawAxisHelper = new ArrowHelper(
            new Vector3(0, 1, 0),
            new Vector3(0, 0, 0),
            1.5,
            0x00ff00,
        ) // Green (Y)
        this.pitchAxisHelper = new ArrowHelper(
            new Vector3(0, 0, 1),
            new Vector3(0, 0, 0),
            1.5,
            0x0000ff,
        ) // Blue (Z)

        this.debugGroup.add(this.rollAxisHelper)
        this.debugGroup.add(this.yawAxisHelper)
        this.debugGroup.add(this.pitchAxisHelper)

        // 4. 법선 벡터 화살표 (월드 좌표계가 필요하므로 Scene에 추가)
        if (this.context?.scene) {
            this.debugNormalArrow = new ArrowHelper(
                new Vector3(0, 1, 0),
                new Vector3(0, 0, 0),
                1.0,
                0xffff00,
            )
            this.debugNormalArrow.visible = false
            this.context.scene.add(this.debugNormalArrow)
        }
    }

    /**
     * 디버그 모드를 켜거나 끕니다. 모든 시각적 보조 도구를 제어합니다.
     */
    public setDebugMode(isEnabled: boolean) {
        this.debugMode = isEnabled

        // 그룹 전체 Visibility 토글
        this.debugGroup.visible = isEnabled

        // Scene에 별도로 붙은 객체 토글
        if (this.debugNormalArrow) {
            this.debugNormalArrow.visible = isEnabled
        }

        console.log(`🛠️ SpaceShip Debug Mode: ${isEnabled ? "ON" : "OFF"}`)
    }

    /**
     * TweakPane 설정 (URL 파라미터 '?debug=spaceship' 감지)
     */
    private setupTweakPane() {
        const urlParams = new URLSearchParams(window.location.search)
        const debugParam = urlParams.get("debug")
        const shouldEnable = debugParam === "spaceship"

        // [수정] 초기 상태 적용
        if (shouldEnable) {
            this.setDebugMode(true)
        } else {
            this.setDebugMode(this.debugMode)
        }

        if (shouldEnable) {
            const pane = TweakPane.getInstance()
            const f = pane.addFolder({
                title: "SpaceShip Debug Controls",
                expanded: true,
            })

            // [수정] Proxy Object를 사용하여 TweakPane 바인딩 타입 에러 해결
            const PARAMS = {
                debugMode: this.debugMode,
            }

            f.addBinding(PARAMS, "debugMode", { label: "Show Visuals" }).on(
                "change",
                (ev) => {
                    this.setDebugMode(ev.value)
                },
            )

            this.positionDebugModule.setupDebugControls(f)
            this.cameraDebugModule.setupDebugControls(f)

            // [수정] visualDebugModule 사용 (Unused Variable 에러 해결)
            this.visualDebugModule.setupDebugControls(f)
        }
    }

    public updatePhysics(deltaTime: number) {
        if (!this.rigidBody || !this.context || !this.shipPivot) return

        this.updateShapecast()

        if (!this.isLocked) {
            this.flightController.handleMovement(this.rigidBody, deltaTime)
        }
    }

    public update(deltaTime: number) {
        if (!this.rigidBody || !this.shipPivot || !this.context) return

        // 1. 물리 위치 동기화 (보간 없이 직접 동기화)
        // Variable Physics Timestep을 사용하므로 화면 갱신과 물리 갱신이 1:1로 동기화됨
        const position = this.rigidBody.translation()
        const rotation = this.rigidBody.rotation()
        
        this.shipPivot.position.set(position.x, position.y, position.z)
        this.shipPivot.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w,
        )

        // 2. 컴포넌트 업데이트
        this.updateCameraTracking()
        this.processInputAndVisuals(deltaTime)
        this.updateFlameLength(deltaTime)
    }

    // 전방 장애물 감지 로직 (ShapeCast)
    public updateShapecast() {
        if (!this.rigidBody || !this.context || !this.shipPivot) {
            return
        }

        const world = this.context.physics.world
        const shape = new Cuboid(
            this.castShapeHalfExtents.x,
            this.castShapeHalfExtents.y,
            this.castShapeHalfExtents.z,
        )

        const currentPos = this.rigidBody.translation()
        const shapeRot = this.rigidBody.rotation()

        // 방향 및 오프셋 계산
        const shapeVel = new Vector3(1, 0, 0)
            .applyQuaternion(this.shipPivot.quaternion)
            .normalize()
        const forwardOffset = shapeVel
            .clone()
            .multiplyScalar(this.shapecastOffset.forward)
        const upVector = new Vector3(0, 1, 0)
            .applyQuaternion(this.shipPivot.quaternion)
            .normalize()
        const upOffset = upVector
            .clone()
            .multiplyScalar(this.shapecastOffset.up)

        const shapePos = {
            x: currentPos.x + forwardOffset.x + upOffset.x,
            y: currentPos.y + forwardOffset.y + upOffset.y,
            z: currentPos.z + forwardOffset.z + upOffset.z,
        }

        // 그룹 필터링: 바닥(Group 1) 무시, 장애물(Group 2) 감지
        const interactionGroups = (0x0001 << 16) | 0x0002

        const hit = world.castShape(
            shapePos,
            shapeRot,
            shapeVel,
            shape,
            this.detectionRange,
            this.detectionRange,
            true,
            undefined,
            interactionGroups,
            undefined,
            this.rigidBody,
        )

        if (hit && hit.time_of_impact < this.detectionRange) {
            this.isObstacle = true
        } else {
            this.isObstacle = false
        }

        // 🎨 디버그 시각화 (켜져 있을 때만 색상 업데이트)
        if (this.debugMode && this.debugCastMesh) {
            ;(this.debugCastMesh.material as MeshBasicMaterial).color.setHex(
                this.isObstacle ? this.COLOR_HIT : this.COLOR_SAFE,
            )
        }
    }

    private processInputAndVisuals(deltaTime: number) {
        if (
            !this.rigidBody ||
            !this.shipPivot ||
            !this.context ||
            this.isLocked
        )
            return
        this.joyStick.update(deltaTime, this.context, this.shipPivot.position)

        const input = this.context.inputManager
        const thrustInput =
            (input.isAction("MoveForward") ? 1 : 0) +
            (input.isAction("MoveBackward") ? -1 : 0)
        const rollInput =
            (input.isAction("TurnLeft") ? -1 : 0) +
            (input.isAction("TurnRight") ? 1 : 0)

        // 장애물 감지 시 전진 차단
        this.flightController.setBlocked(this.isObstacle)

        const isKeyboardActive =
            Math.abs(thrustInput) > 0.1 || Math.abs(rollInput) > 0.1
        if (isKeyboardActive) {
            this.flightController.updatePointerInput(new Vector2(0))
            // 후진은 허용하되 전진만 막음
            const effectiveThrust =
                this.isObstacle && thrustInput > 0 ? 0 : thrustInput
            this.flightController.updateMovementInput(
                rollInput,
                effectiveThrust,
            )
        } else {
            const isThrustAllowed = !this.isObstacle
            this.flightController.updatePointerInput(
                this.joyStick.outputVector,
                isThrustAllowed,
            )
            this.flightController.updateMovementInput(0, 0)
        }

        // Physics movement handled in fixedUpdate

        this.updateBankingEffect(rollInput)
        this.updateControlIndicators(rollInput, thrustInput)

        // 오디오 및 카메라 모드 처리
        if (
            Math.abs(thrustInput) > 0 ||
            Math.abs(rollInput) > 0 ||
            this.flightController.pointerVector !== null
        ) {
            if (!this.context.audio.isPlaying("engine"))
                this.context.audio.play("engine")
            if (this.context.camera.mode !== "follow") {
                this.context.camera.setFollowTargetObject(
                    this.shipPivot,
                    this.flightCameraOffset,
                    0.12,
                )
                this.context.camera.mode = "follow"
                if (this.context.camera.orbitControls)
                    this.context.camera.orbitControls.enabled = false
            }
        } else {
            if (this.context.audio.isPlaying("engine"))
                this.context.audio.stop("engine")
        }
    }

    private updateFlameLength(deltaTime: number) {
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
            flame.setFlameLength(this.currentFlameLength)
            flame.update(deltaTime)
        })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 🎮 INPUT HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    public setupInputListeners(): void {
        const domElement = this.context.domElement
        domElement.addEventListener(
            "pointerdown",
            (event: PointerEvent) => {
                if (!this.context) return
                if (event.button === 0 || event.button === 1) {
                    if (this.context.camera.orbitControls) {
                        if (!this.shipPivot) return
                        const targetPos = this.shipPivot.getWorldPosition(
                            new Vector3(),
                        )
                        this.context.camera.orbitControls.target.copy(targetPos)
                        this.context.camera.orbitControls.update()
                        this.context.camera.orbitControls.enabled = true
                        this.context.camera.mode = "orbit"
                    }
                    this.context.camera.setFollowTargetObject(null)
                }
            },
            { capture: true },
        )
    }

    private updateControlIndicators(roll: number, thrust: number): void {
        const keyW = document.getElementById("key-w")
        const keyA = document.getElementById("key-a")
        const keyS = document.getElementById("key-s")
        const keyD = document.getElementById("key-d")
        if (keyW) keyW.classList.toggle("active", thrust > 0.1)
        if (keyA) keyA.classList.toggle("active", roll < -0.1)
        if (keyS) keyS.classList.toggle("active", thrust < -0.1)
        if (keyD) keyD.classList.toggle("active", roll > 0.1)
    }

    private updateCameraTracking(): void {
        if (!this.context || !this.shipPivot) return
        this.context.camera.setFollowTargetObject(
            this.shipPivot,
            this.flightCameraOffset,
            0.12,
        )
    }

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
            duration: 0.8,
            ease: "power2.out",
            overwrite: true,
        })
    }

    // Getters / Setters
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
}

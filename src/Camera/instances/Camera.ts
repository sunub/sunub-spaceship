import CameraControls from "camera-controls"
import { OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three/webgpu"
import { InputManager } from "@/Inputs/InputManager"
import {
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    Vector2,
    Vector3,
} from "three/webgpu"
import type { Size } from "@/utils/Size"
import { TweakPane } from "../../Debug/TweakPane"
// Debug Modules
import { CameraParametersDebugModule } from "../debug/Camera.ParametersDebug"
import { CameraPositionDebugModule } from "../debug/Camera.PositionDebug"
import { CameraTargetDebugModule } from "../debug/Camera.TargetDebug"
import type { CameraConfig } from "../types"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type Time from "@/utils/Time"
import type { DOMManager } from "@/core/DOMManger"

type CameraMode = "orbit" | "follow" | "entry"

interface Angle {
    value: Vector3 // Offset (카메라와 타겟 사이의 거리/방향 벡터)
    target: Vector3 // LookAt Point (카메라가 바라보는 중심점)
}

type CustomOrbitControls = OrbitControls & {
    enableKeys?: boolean
}

interface Zoom {
    easing: number
    minDistance: number
    amplitude: number
    value: number
    targetValue: number
    distance: number
}

interface Pan {
    enabled: boolean
    active: boolean
    easing: number
    start: {
        x: number
        y: number
    }
    value: {
        x: number
        y: number
    }
    targetValue: {
        x: number
        y: number
    }
    raycaster: Raycaster
    mouse: Vector2
    needsUpdate: boolean
    hitMesh: Mesh
    reset: () => void
    enable: () => void
    disable: () => void
    down: (_x: number, _y: number) => void
    move: (_x: number, _y: number) => void
    up: () => void
}

@injectable()
export class Camera {
    public container: Object3D
    public instance!: PerspectiveCamera
    public orbitControls?: CustomOrbitControls
    public zoom: Zoom = {
        easing: 0,
        minDistance: 0,
        amplitude: 0,
        value: 0,
        targetValue: 0,
        distance: 0,
    }
    public pan!: Pan
    public mode: CameraMode = "orbit"
    public cameraControls!: CameraControls
    public isTransitioning: boolean = false

    private parametersDebugModule!: CameraParametersDebugModule
    private positionDebugModule!: CameraPositionDebugModule
    private targetDebugModule!: CameraTargetDebugModule

    private angle: Angle = {
        value: new Vector3(0, 0, 0),
        target: new Vector3(0, 0, 0),
    }

    private isManualControlling: boolean = false
    private mouseSensitivity: number = 20.0 // 감도 조절

    // --- Camera follow 관련 추가 ---
    private followTargetObject?: Object3D
    private followOffset: Vector3 = new Vector3(8, 30, 8)
    private followEasing: number = 0.12

    CAMERA_PARAMS: CameraConfig = {
        fov: 40,
        aspect: window.innerWidth / window.innerHeight,
        near: 1,
        far: 2000,
        targetX: 0,
        targetY: 39,
        targetZ: 0,
        position: {
            x: 0,
            y: 39,
            z: 10,
        },
    }

    constructor(
        @inject(GAME_CONTEXT.UTILITY.Size) private size: Size,
        @inject(GAME_CONTEXT.UTILITY.Time) private time: Time,
        @inject(GAME_CONTEXT.MANAGER.DOMManager) private domManager: DOMManager,
        @inject(GAME_CONTEXT.MANAGER.InputManager) private inputManager: InputManager,
    ) {
        this.container = new Object3D()
        this.container.matrixAutoUpdate = false
    }

    async initialize() {
        this.setupInstance()
        this.setupZoom()
        this.setupPan()
        this.setupOrbitControls()

        CameraControls.install({ THREE })
        this.cameraControls = new CameraControls(
            this.instance,
            this.domManager.domElement,
        )

        this.setInitialPosition()
        this.instance.far = 2000
        this.instance.updateProjectionMatrix()
        this.initializeDebugModules()

        this.size.on("resize", () => this.handleResize(this.size))

        // this.time.on("tick", () => this.update()) // Game Loop에서 직접 호출하도록 변경
    }

    public update() {
        if (this.isTransitioning) {
            this.updateCameraTransformFromAngle()
            return
        }

        if (this.mode === "follow" && this.followTargetObject) {
            this.handleMouseInput()

            const targetPos = this.followTargetObject.getWorldPosition(new Vector3())

            // 수동 조작 중이 아닐 때만 타겟 위치로 Focus Point를 부드럽게 이동
            if (!this.isManualControlling) {
                // Focus Point(angle.target)가 우주선(targetPos)을 따라가게 함
                this.angle.target.lerp(targetPos, this.followEasing)
            }

            // 카메라 위치 계산: Focus Point + Offset
            // Offset은 고정되어 있지만, Focus Point가 이동하므로 카메라도 따라감
            const desiredPos = this.angle.target.clone().add(this.followOffset)

            this.instance.position.lerp(desiredPos, this.followEasing)
            this.instance.lookAt(this.angle.target)

            this.angle.value.subVectors(this.instance.position, this.angle.target)

            return
        } else if (this.mode === "orbit" && this.orbitControls?.enabled) {
            this.orbitControls.update()

            this.angle.target.copy(this.orbitControls.target)
            this.angle.value.subVectors(
                this.instance.position,
                this.angle.target,
            )
        }
    }

    private handleMouseInput() {
        const mouseState = this.inputManager.getMouseState()

        if (mouseState.isDown) {
            this.isManualControlling = true

            // 1. 카메라의 Forward, Right 벡터 계산 (월드 기준, Y축 무시)
            const forward = new Vector3()
            this.instance.getWorldDirection(forward)
            forward.y = 0
            forward.normalize()

            const right = new Vector3()
            right.crossVectors(forward, new Vector3(0, 1, 0)).normalize()

            // 2. 이동 벡터 계산
            const sensitivity = this.mouseSensitivity

            // 드래그 방향과 물체 이동 방향을 일치시킴 (Drag to move target)
            // deltaX > 0 (오른쪽 드래그) -> right 방향 이동
            // deltaY > 0 (위쪽 드래그) -> forward 방향 이동
            const moveVector = new Vector3()
                .addScaledVector(right, mouseState.deltaX * sensitivity)
                .addScaledVector(forward, mouseState.deltaY * sensitivity)

            this.angle.target.add(moveVector)
        }
    }

    public stopManualControl() {
        this.isManualControlling = false
    }

    public getFocusTarget(out: Vector3 = new Vector3()): Vector3 {
        return out.copy(this.angle.target)
    }


    private updateCameraTransformFromAngle() {
        // 카메라 위치 = 바라보는 점(Target) + 떨어진 거리 벡터(Value/Offset)
        // 메모리 할당 최적화: clone() 제거하고 instance.position에 직접 연산
        this.instance.position.copy(this.angle.target).add(this.angle.value)
        this.instance.lookAt(this.angle.target)
    }

    public setFollowTargetObject(
        targetObject: Object3D | null,
        offset?: Vector3,
        easing?: number,
    ) {
        if (targetObject === null) {
            this.followTargetObject = undefined
            return
        }
        this.followTargetObject = targetObject
        if (offset) this.followOffset = offset.clone()
        if (typeof easing === "number") this.followEasing = easing
    }

    public setupAngle() {
        this.angle = {
            value: new Vector3(0, 10, 0),
            target: new Vector3(0, 0, 0),
        }
    }

    public setupPan() {
        this.pan = {} as Pan
        this.pan.enabled = false
        this.pan.active = false
        this.pan.easing = 0.1
        this.pan.start = { x: 0, y: 0 }
        this.pan.value = { x: 0, y: 0 }
        this.pan.targetValue = { x: 0, y: 0 }

        this.pan.raycaster = new Raycaster()
        this.pan.mouse = new Vector2()
        this.pan.needsUpdate = false
        this.pan.hitMesh = new Mesh(
            new PlaneGeometry(500, 500, 1, 1),
            new MeshBasicMaterial({
                color: 0xff0000,
                wireframe: true,
                visible: false,
            }),
        )
        this.container.add(this.pan.hitMesh)

        this.pan.reset = () => {
            this.pan.targetValue.x = 0
            this.pan.targetValue.y = 0
        }

        this.pan.enable = () => {
            this.pan.enabled = true
            this.domManager.domElement.classList.add("has-cursor-grab")
        }

        this.pan.disable = () => {
            this.pan.enabled = false
            this.domManager.domElement.classList.remove("has-cursor-grab")
        }

        this.pan.down = (_x, _y) => {
            if (!this.pan.enabled) return
            this.domManager.domElement.classList.add("has-cursor-grabbing")
            this.pan.active = true
            this.pan.mouse.x = (_x / this.size.width) * 2 - 1
            this.pan.mouse.y = -(_y / this.size.height) * 2 + 1
            this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance)
            const intersects = this.pan.raycaster.intersectObjects([
                this.pan.hitMesh,
            ])
            if (intersects.length) {
                this.pan.start.x = intersects[0].point.x
                this.pan.start.y = intersects[0].point.y
            }
        }

        this.pan.move = (_x, _y) => {
            if (!this.pan.enabled || !this.pan.active) return
            this.pan.mouse.x = (_x / this.size.width) * 2 - 1
            this.pan.mouse.y = -(_y / this.size.height) * 2 + 1
            this.pan.needsUpdate = true
        }

        this.pan.up = () => {
            this.pan.active = false
            this.domManager.domElement.classList.remove("has-cursor-grabbing")
        }

        window.addEventListener("mousedown", (e) =>
            this.pan.down(e.clientX, e.clientY),
        )
        window.addEventListener("mousemove", (e) =>
            this.pan.move(e.clientX, e.clientY),
        )
        window.addEventListener("mouseup", () => this.pan.up())

        this.time.on("tick", () => {
            if (this.pan.active && this.pan.needsUpdate) {
                this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance)
                const intersects = this.pan.raycaster.intersectObjects([
                    this.pan.hitMesh,
                ])
                if (intersects.length) {
                    this.pan.targetValue.x = -(
                        intersects[0].point.x - this.pan.start.x
                    )
                    this.pan.targetValue.y = -(
                        intersects[0].point.y - this.pan.start.y
                    )
                }
                this.pan.needsUpdate = false
            }
            this.pan.value.x +=
                (this.pan.targetValue.x - this.pan.value.x) * this.pan.easing
            this.pan.value.y +=
                (this.pan.targetValue.y - this.pan.value.y) * this.pan.easing
        })
    }

    setupZoom() {
        this.zoom.easing = 0.1
        this.zoom.minDistance = 14
        this.zoom.amplitude = 15
        this.zoom.value = 0.5
        this.zoom.targetValue = this.zoom.value
        this.zoom.distance =
            this.zoom.minDistance + this.zoom.amplitude * this.zoom.value

        document.addEventListener(
            "wheel",
            (_event) => {
                this.zoom.targetValue += _event.deltaY * 0.001
                this.zoom.targetValue = Math.min(
                    Math.max(this.zoom.targetValue, 0),
                    1,
                )
            },
            { passive: true },
        )

        this.time.on("tick", () => {
            this.zoom.value +=
                (this.zoom.targetValue - this.zoom.value) * this.zoom.easing
            this.zoom.distance =
                this.zoom.minDistance + this.zoom.amplitude * this.zoom.value
        })
    }

    setupInstance() {
        const { fov, near, far } = this.CAMERA_PARAMS
        const aspect = this.size.width / this.size.height || this.CAMERA_PARAMS.aspect
        this.instance = new PerspectiveCamera(fov, aspect, near, far)
        this.instance.up.set(0, 1, 0)

        if (this.angle) {
            // 초기 생성 시에도 올바른 위치 계산 적용
            this.updateCameraTransformFromAngle()
        }

        this.instance.lookAt(new Vector3())
        this.container.add(this.instance)

        this.size.on("resize", () => {
            this.instance.aspect = this.size.width / this.size.height
            this.instance.updateProjectionMatrix()
        })

        // initialize()의 tick 리스너와 로직이 중복되거나 충돌할 수 있어
        // setupInstance의 tick 로직은 제거하고 initialize에 통합하는 것이 좋지만
        // 기존 구조 유지를 위해 필요한 최소한의 보간 로직은 initialize의 tick으로 대체됨.
    }

    setupOrbitControls() {
        this.orbitControls = new OrbitControls(
            this.instance,
            this.domManager.domElement,
        )
        this.orbitControls.enabled = true
        this.orbitControls.enableKeys = false
        this.orbitControls.zoomSpeed = 0.5
        this.orbitControls.maxPolarAngle = Math.PI / 2
    }

    // --- 전환 보간 상태 (GameLoop 틱 기반, GSAP rAF 이중 실행 제거) ---
    private transitionProgress: number = 0
    private transitionDuration: number = 0
    private transitionStartTarget: Vector3 = new Vector3()
    private transitionEndTarget: Vector3 = new Vector3()
    private transitionStartOffset: Vector3 = new Vector3()
    private transitionEndOffset: Vector3 = new Vector3()
    private transitionNewMode: CameraMode = "orbit"
    private transitionResolve: (() => void) | null = null

    /**
     * power2.inOut easing — 순수 수학 함수로 대체하여 GSAP 의존 제거
     */
    private easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    }

    /**
     * GameLoop에서 매 프레임 호출하여 전환 보간을 진행합니다.
     * GSAP의 별도 rAF 틱 대신 이미 실행 중인 GameLoop 틱에 통합하여
     * 이중 틱으로 인한 프레임 저하를 방지합니다.
     */
    public updateTransition(deltaTime: number): void {
        if (!this.isTransitioning || this.transitionDuration <= 0) return

        this.transitionProgress += deltaTime / this.transitionDuration
        const t = Math.min(this.transitionProgress, 1)
        const eased = this.easeInOutQuad(t)

        // target(lookAt 포인트) 보간
        this.angle.target.lerpVectors(
            this.transitionStartTarget,
            this.transitionEndTarget,
            eased,
        )

        // offset(카메라-타겟 거리/각도) 보간
        this.angle.value.lerpVectors(
            this.transitionStartOffset,
            this.transitionEndOffset,
            eased,
        )

        // 카메라 위치 반영
        this.updateCameraTransformFromAngle()

        if (t >= 1) {
            this.completeTransition()
        }
    }

    private completeTransition(): void {
        this.isTransitioning = false
        this.mode = this.transitionNewMode

        if (this.transitionNewMode === "orbit" && this.orbitControls) {
            this.orbitControls.target.copy(this.angle.target)
            this.orbitControls.enabled = true
            this.instance.lookAt(this.angle.target)
            this.orbitControls.update()
        }

        if (this.transitionResolve) {
            this.transitionResolve()
            this.transitionResolve = null
        }
    }

    public transitionTo(
        newMode: CameraMode,
        targetOffset: Vector3,
        newTarget: Vector3,
        duration: number = 1.5,
    ): Promise<void> {
        return new Promise((resolve) => {
            // 1. 기존 컨트롤 비활성화 및 상태 플래그 설정
            if (this.orbitControls) this.orbitControls.enabled = false
            this.isTransitioning = true

            // Duration이 거의 0이면 즉시 이동
            if (duration <= 0.01) {
                this.mode = newMode
                this.angle.target.copy(newTarget)
                this.angle.value.copy(targetOffset)

                // 즉시 반영
                this.updateCameraTransformFromAngle()

                this.isTransitioning = false

                if (newMode === "orbit" && this.orbitControls) {
                    this.orbitControls.target.copy(newTarget)
                    this.orbitControls.enabled = true
                    this.orbitControls.update()
                }
                resolve()
                return
            }

            // 2. GameLoop 보간 기반 전환 (GSAP rAF 이중 실행 제거)
            this.transitionProgress = 0
            this.transitionDuration = duration
            this.transitionStartTarget.copy(this.angle.target)
            this.transitionEndTarget.copy(newTarget)
            this.transitionStartOffset.copy(this.angle.value)
            this.transitionEndOffset.copy(targetOffset)
            this.transitionNewMode = newMode
            this.transitionResolve = resolve
        })
    }

    handleResize(size: Size) {
        const stageWidth = size.width
        const stageHeight = size.height

        this.instance.aspect = stageWidth / stageHeight
        this.instance.updateProjectionMatrix()
    }

    private setInitialPosition() {
        const cameraTarget = new Vector3(
            this.CAMERA_PARAMS.targetX,
            this.CAMERA_PARAMS.targetY,
            this.CAMERA_PARAMS.targetZ,
        )
        this.instance.position.set(
            this.CAMERA_PARAMS.position.x,
            this.CAMERA_PARAMS.position.y,
            this.CAMERA_PARAMS.position.z,
        )

        this.instance.rotation.setFromRotationMatrix(this.instance.matrixWorld)
        this.instance.lookAt(cameraTarget)

        // 초기 상태 angle 값 동기화 (중요)
        this.angle.target.copy(cameraTarget)
        this.angle.value.subVectors(this.instance.position, cameraTarget)

        if (this.orbitControls) {
            this.orbitControls.target.copy(cameraTarget)
            this.orbitControls.update()
        }
    }

    private initializeDebugModules(): void {
        if (!this.checkDebugMode()) {
            return
        }

        const pane = TweakPane.getInstance()
        const folder = pane.addFolder({
            title: "📷 Camera Debug Controls",
            expanded: true,
        })

        this.parametersDebugModule = new CameraParametersDebugModule(
            this.instance,
            this.CAMERA_PARAMS,
        )
        this.positionDebugModule = new CameraPositionDebugModule(
            this.instance,
            this.CAMERA_PARAMS,
        )
        this.targetDebugModule = new CameraTargetDebugModule(
            this,
            this.CAMERA_PARAMS,
        )

        this.parametersDebugModule.setupDebugControls(folder)
        this.positionDebugModule.setupDebugControls(folder)
        this.targetDebugModule.setupDebugControls(folder)
    }

    private checkDebugMode(): boolean {
        const urlParams = new URLSearchParams(window.location.search)
        const debugParam = urlParams.get("debug")
        return debugParam === "camera"
    }
}

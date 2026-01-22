import {
    add,
    color,
    distance,
    dot,
    mix,
    normalize,
    smoothstep,
    sub,
    uniform,
    uv,
    vec2,
} from "three/tsl"
import type { Camera, Object3D } from "three/webgpu"
import {
    ArrowHelper,
    Box3,
    DoubleSide,
    Mesh,
    MeshStandardNodeMaterial,
    Plane,
    PlaneGeometry,
    Raycaster,
    Vector2,
    Vector3,
} from "three/webgpu"
import type { GameContext } from "@/core/GameContext"

export class JoyStick {
    public centerX: number
    public centerY: number
    public centerZ: number
    public size: Vector3

    private plane!: Mesh

    private raycaster = new Raycaster()
    private mathPlane = new Plane(new Vector3(0, 1, 0), 0)
    private intersectPoint = new Vector3()

    public outputVector = new Vector2(0, 0)
    private maxRadius = 1.0
    public pointer = new Vector2()

    private uPointerDirection = uniform(vec2(0, 0)) // 포인터 방향 (단위 벡터)
    private uIsActive = uniform(0) // 조이스틱 활성화 여부 (0 or 1)
    private uTime = uniform(0)

    private isDragging = false

    private targetArrow = new ArrowHelper(
        new Vector3(1, 0, 0),
        new Vector3(),
        5,
        0xff0000,
    ) // 빨강: 실제 타겟 지점
    private shipForwardArrow = new ArrowHelper(
        new Vector3(1, 0, 0),
        new Vector3(),
        5,
        0x00ff00,
    ) // 초록: 우주선 현재 정면
    private outputArrow = new ArrowHelper(
        new Vector3(1, 0, 0),
        new Vector3(),
        5,
        0xffff00,
    )

    constructor() {
        this.centerX = 0
        this.centerY = 0
        this.centerZ = 0
        this.size = new Vector3()
    }

    drawJoyStick(context: GameContext, targetObject: Object3D) {
        const box = new Box3().setFromObject(targetObject)
        const center = box.getCenter(new Vector3())
        this.centerX = center.x
        this.centerY = center.y
        this.size = box.getSize(new Vector3())

        const maxDimension = Math.max(this.size.x, this.size.z)
        const squareSize = maxDimension
        const squareSizeOffset = squareSize * 1.25
        this.maxRadius = (squareSize + squareSizeOffset) * 0.5

        const planeGeometry = new PlaneGeometry(
            squareSize + squareSizeOffset,
            squareSize + squareSizeOffset,
        )
        const planeMaterial = new MeshStandardNodeMaterial({
            side: DoubleSide,
            transparent: true,
            depthWrite: false,
            depthTest: false,
        })

        // --- 쉐이더 노드 설정 시작 ---
        const circleCenter = uniform(vec2(0.5, 0.5))
        const outerRadius = uniform(0.5)
        const thickness = uniform(0.05) // 배경 링의 두께
        const smoothing = uniform(0.01)

        const fanInnerClearance = uniform(0.3)

        // 색상 정의
        const baseRingColor = color(0xffffff) // 배경 링 색상 (흰색)
        const activeFanColor = color(0x00ffff) // 활성 부채꼴 색상 (하늘색)

        // 현재 픽셀의 중심으로부터의 거리
        const dist = distance(uv(), circleCenter)

        // [1] 배경 링 지오메트리 정의 (기존 로직 유지)
        const innerRadius = sub(outerRadius, thickness)
        // 바깥원 (가장자리 부드럽게)
        const outerCircleShape = smoothstep(
            outerRadius.add(smoothing),
            outerRadius,
            dist,
        )
        // 안쪽원 (구멍 뚫기용)
        const innerCircleShape = smoothstep(
            innerRadius.add(smoothing),
            innerRadius,
            dist,
        )
        // 최종 링 모양 (바깥원 - 안쪽원)
        const baseRingShape = sub(outerCircleShape, innerCircleShape)

        // [2] 부채꼴 방향 마스크 정의 (핵심 변경 사항)
        const uvDir = normalize(uv().sub(circleCenter))
        // 포인터 방향을 쉐이더 내에서 정규화하여 길이 영향을 제거
        const pointerDir = normalize(this.uPointerDirection)
        // 내적 계산 (-1 ~ 1 범위)
        const alignment = dot(uvDir, pointerDir)

        // 부채꼴 각도 조절: 첫 번째 인자를 조절하세요.
        // 0.85: 넓은 부채꼴 / 0.95: 좁은 부채꼴 / 0.99: 바늘
        const fanAngleStart = 0.85
        const fanMask = smoothstep(fanAngleStart, 1.0, alignment).mul(
            this.uIsActive,
        )

        const fanHoleShape = smoothstep(
            fanInnerClearance,
            fanInnerClearance.add(smoothing),
            dist,
        )
        // 부채꼴 모양은 '꽉 찬 바깥원'과 '방향 마스크'의 곱입니다.
        // (중심 구멍인 innerCircleShape를 빼지 않는 것이 중요합니다)
        const finalFanShape = outerCircleShape.mul(fanMask).mul(fanHoleShape)

        // [3] 최종 재질 적용
        // 색상: 부채꼴 영역이면 하늘색, 아니면 흰색
        planeMaterial.colorNode = mix(baseRingColor, activeFanColor, fanMask)

        // 투명도(Opacity) 합성:
        // 배경 링은 연하게(0.2) 표시 + 부채꼴은 진하게(1.0) 표시
        // add를 사용하여 두 모양이 겹치는 부분은 더 밝게 빛나게 처리
        planeMaterial.opacityNode = add(baseRingShape.mul(0.075), finalFanShape)

        this.plane = new Mesh(planeGeometry, planeMaterial)

        this.plane.rotation.x = -Math.PI / 2
        this.plane.renderOrder = 999
        this.plane.visible = false

        context.scene.add(this.plane)

        context.scene.add(this.targetArrow)
        context.scene.add(this.shipForwardArrow)
        context.scene.add(this.outputArrow)

        window.addEventListener("pointerdown", (e) => {
            this.isDragging = true
            this.plane.visible = true
            this.uIsActive.value = 1.0
            this.updatePointerNDC(e)
        })
        window.addEventListener("pointerup", () => {
            this.isDragging = false
            this.plane.visible = false
            this.uIsActive.value = 0.0
            this.outputVector.set(0, 0)
        })
        window.addEventListener("pointermove", (e) => {
            if (this.isDragging) {
                this.updatePointerNDC(e)
            }
        })
    }

    public updatePointerNDC(event: PointerEvent) {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
    }

    public calculatePointerVector(camera: Camera, shipPosition: Vector3) {
        // 1. 카메라와 NDC 좌표를 이용해 레이 설정
        this.raycaster.setFromCamera(this.pointer, camera)
        // 2. 평면의 높이를 우주선의 현재 높이와 일치시킴
        this.mathPlane.constant = -shipPosition.y
        // 3. 레이와 평면의 교차점을 찾음
        this.raycaster.ray.intersectPlane(this.mathPlane, this.intersectPoint)
        // 4. 우주선 기준의 상대 벡터 계산 (Pointer - Ship)
        const relativeVector = new Vector3().subVectors(
            this.intersectPoint,
            shipPosition,
        )

        return relativeVector
    }

    public update(
        deltaTime: number,
        context: GameContext,
        targetPosition: Vector3,
    ) {
        if (!this.isDragging) {
            return
        }

        this.plane.position.set(targetPosition.x, 0.1, targetPosition.z)

        const relativeVector = this.calculatePointerVector(
            context.camera.instance,
            targetPosition,
        )
        const output = new Vector2(relativeVector.x, relativeVector.z)

        this.uPointerDirection.value.set(output.x, -output.y)
        this.uTime.value = deltaTime

        // 최대 반경내로 제한
        const distance = output.length()
        if (distance > this.maxRadius) {
            output.normalize().multiplyScalar(this.maxRadius)
        }
        // 최종 조이스틱 값 (0~1 범위로 정규화하고 싶을 경우)
        const normalizedJoyStickValue = output
            .clone()
            .divideScalar(this.maxRadius)
        this.outputVector.copy(normalizedJoyStickValue)

        const urlParams = new URLSearchParams(window.location.search)
        const debugMode = urlParams.get("debug") === "joystick"
        if (!debugMode || !this.plane.parent) {
            return
        }

        this.targetArrow.position.copy(targetPosition)
        this.targetArrow.setDirection(relativeVector.clone().normalize())

        const currentHeading = new Vector3(1, 0, 0).applyQuaternion(
            this.plane.parent.quaternion,
        )
        this.shipForwardArrow.position.copy(targetPosition)
        this.shipForwardArrow.setDirection(currentHeading)

        const debugOutput3D = new Vector3(output.x, 0, output.y).normalize()
        this.outputArrow.position.copy(targetPosition)
        this.outputArrow.setDirection(debugOutput3D)
    }
}

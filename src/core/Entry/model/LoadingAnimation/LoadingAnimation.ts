import gsap from "gsap"
import { attribute, uniform } from "three/tsl"
import {
    DynamicDrawUsage,
    Group,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    SphereGeometry,
    Vector3,
} from "three/webgpu"
import type { GameContext, IGameObject } from "@/core/GameContext"
import { PlanetMaterial } from "../Planet/PlanetMaterial"

export class LoadingAnimation implements IGameObject {
    private context!: GameContext
    private geometry!: SphereGeometry
    private sphere!: Mesh

    private instancedMesh!: InstancedMesh
    private maxTrails = 20
    private trailData: {
        position: Vector3
        scale: number
        opacity: number
        active: boolean
        time: number
    }[] = []
    private currentTrailIndex = 0
    private isLoaded = false
    private rotationTween!: ReturnType<typeof gsap.to>
    private globalOpacity = 1.0

    constructor(private position: Vector3 = new Vector3(0, 11, 0)) {}

    public async initialize(context: GameContext) {
        this.context = context
        const pivotGroup = new Group()
        this.context.scene.add(pivotGroup)

        this.geometry = new SphereGeometry(0.05, 32, 32)
        const material = new MeshBasicMaterial({ color: 0x00ff00 })
        this.sphere = new Mesh(this.geometry, material)

        this.sphere.position.y = 1.5
        pivotGroup.add(this.sphere)

        // -- Initialize InstancedMesh for Trails --

        // 1. 인스턴스별 투명도(opacity)를 제어하기 위한 BufferAttribute 생성
        const opacityArray = new Float32Array(this.maxTrails).fill(0)
        const opacityAttribute = new InstancedBufferAttribute(opacityArray, 1)

        this.geometry.setAttribute("instanceOpacity", opacityAttribute)

        // 2. Material 생성
        // PlanetMaterial 생성자에는 정의된 커스텀 속성만 전달합니다.
        const trailMaterial = new PlanetMaterial({
            uTime: uniform(0),
            fresnelStrength: 20,
            uColor1: new Vector3(1, 0.5, 1),
            uColor2: new Vector3(1, 0.5, 1),
            uEmissionColor: new Vector3(1, 0.5, 1),
            uEmissionStrength: 3.5,
            opacityNode: attribute("instanceOpacity") as any, // TSL attribute node 연결
        })

        // 3. 기본 Material 속성은 인스턴스 생성 후 별도로 설정 (타입 에러 해결)
        trailMaterial.transparent = true
        trailMaterial.depthWrite = false // 투명 객체 겹침 문제 완화

        this.instancedMesh = new InstancedMesh(
            this.geometry,
            trailMaterial,
            this.maxTrails,
        )
        this.instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage)

        // 4. Trail 데이터 초기화
        for (let i = 0; i < this.maxTrails; i++) {
            this.trailData.push({
                position: new Vector3(),
                scale: 0,
                opacity: 0,
                active: false,
                time: 0,
            })
            // 초기에는 보이지 않게 크기를 0으로 설정
            this.instancedMesh.setMatrixAt(i, new Matrix4().makeScale(0, 0, 0))
        }
        this.context.scene.add(this.instancedMesh)
        this.rotationTween = gsap.to(pivotGroup.rotation, {
            z: Math.PI * 2 * -1,
            duration: 1.75,
            repeat: -1,
            ease: "power2.inOut",
            onRepeat: () => {
                if (this.isLoaded) {
                    this.rotationTween.repeat(0)
                }
            },
            onComplete: () => {
                this.fadeOut()
            },
        })

        pivotGroup.position.set(
            this.position.x,
            this.position.y,
            this.position.z,
        )
    }

    private fadeOut() {
        gsap.to(this, {
            globalOpacity: 0,
            duration: 0.5,
            onUpdate: () => {
                ;(this.sphere.material as MeshBasicMaterial).opacity =
                    this.globalOpacity
            },
            onComplete: () => {
                this.rotationTween.kill()
            },
        })
    }

    public setLoaded() {
        this.isLoaded = true
    }

    public update(time: number): void {
        const currentIndex = this.currentTrailIndex % this.maxTrails
        const trail = this.trailData[currentIndex]

        this.sphere.updateWorldMatrix(true, false)
        const worldPos = this.sphere.getWorldPosition(new Vector3())

        trail.active = true
        trail.position.copy(worldPos)
        trail.scale = 1.2
        trail.opacity = 1.0
        trail.time = time

        this.currentTrailIndex++

        const dummyMatrix = new Matrix4()
        const opacityAttr = this.geometry.attributes
            .instanceOpacity as InstancedBufferAttribute

        for (let i = 0; i < this.maxTrails; i++) {
            const d = this.trailData[i]

            if (!d.active) {
                // 비활성 인스턴스는 숨김 처리
                dummyMatrix.makeScale(0, 0, 0)
                this.instancedMesh.setMatrixAt(i, dummyMatrix)
                opacityAttr.setX(i, 0)
                continue
            }

            // 감쇠 로직 (Decay)
            d.opacity *= 0.85
            d.scale *= 0.95

            // 투명도가 너무 낮아지면 비활성화
            if (d.opacity < 0.01) {
                d.active = false
                d.opacity = 0
                d.scale = 0
            }

            // 매트릭스 업데이트 (위치, 스케일)
            dummyMatrix.makeTranslation(d.position)
            dummyMatrix.scale(new Vector3(d.scale, d.scale, d.scale))
            this.instancedMesh.setMatrixAt(i, dummyMatrix)

            // 투명도 속성 업데이트
            opacityAttr.setX(i, d.opacity * this.globalOpacity)
        }

        if (this.sphere.material instanceof MeshBasicMaterial) {
            this.sphere.material.transparent = true
            this.sphere.material.opacity = this.globalOpacity
        }

        // 변경 사항 GPU 업로드 요청
        this.instancedMesh.instanceMatrix.needsUpdate = true
        opacityAttr.needsUpdate = true

        // 셰이더 시간 업데이트 (필요한 경우 주석 해제)
        // (this.instancedMesh.material as PlanetMaterial).uTime.value = time
    }
}

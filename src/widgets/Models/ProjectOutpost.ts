import gsap from "gsap"
import {
    uniform,
    vec3,
    // UniformNode는 export되지 않을 수 있으므로 제거하거나 Node로 대체
} from "three/tsl"
import {
    CircleGeometry,
    Color,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshBasicNodeMaterial, // 👈 [수정] three/tsl이 아닌 three/webgpu에서 가져옴
    TorusGeometry,
    Vector3,
} from "three/webgpu"

import type { GameContext, IGameObject } from "@/core/GameContext"
import type { ProjectData } from "@/core/ProjectRegistry"
import { ProjectHUD } from "../UI/ProjectHUD"
import { TriggerRegion } from "./Area/TriggerRegion"

export class ProjectOutpost implements IGameObject {
    private trigger: TriggerRegion
    private hud: ProjectHUD
    private mesh: Group

    // 비주얼 요소
    private floorPlane: Mesh
    private idleBorderMesh: Mesh

    private context: GameContext | null = null

    // 애니메이션 제어 변수
    private pulseTween: gsap.core.Tween | null = null
    private idleTween: gsap.core.Tween | null = null

    // 지오메트리 캐싱
    private pulseGeometry: TorusGeometry

    constructor(private projectData: ProjectData) {
        this.mesh = new Group()
        this.mesh.position.copy(projectData.position)
        this.mesh.position.y = 0.05

        // 1. 바닥 원 (Floor Plane) - 배경용
        const radius = 6
        const segments = 64
        const planeGeo = new CircleGeometry(radius, segments)
        const planeMat = new MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0,
            side: DoubleSide,
            depthWrite: false,
            depthTest: false,
        })
        this.floorPlane = new Mesh(planeGeo, planeMat)
        this.floorPlane.rotation.x = -Math.PI / 2
        this.floorPlane.renderOrder = 998
        this.mesh.add(this.floorPlane)

        // 2. 대기 상태 테두리 (Idle Border) - 두께와 Bloom 효과 적용
        const borderGeo = new TorusGeometry(radius, 0.1, 16, 128)

        // TSL Material 설정
        const uBorderColor = uniform(new Color(0x00ffff))
        const uBorderOpacity = uniform(0.3)
        const uBorderIntensity = uniform(1.5)

        const borderMat = new MeshBasicNodeMaterial()
        borderMat.transparent = true
        borderMat.depthWrite = false
        borderMat.depthTest = false
        // Bloom 공식: 색상 * 강도
        borderMat.colorNode = vec3(uBorderColor).mul(uBorderIntensity)
        borderMat.opacityNode = uBorderOpacity

        this.idleBorderMesh = new Mesh(borderGeo, borderMat)
        this.idleBorderMesh.rotation.x = -Math.PI / 2
        this.idleBorderMesh.renderOrder = 999
        this.mesh.add(this.idleBorderMesh)

        // 대기 상태 애니메이션 시작 (숨쉬는 효과)
        this.startIdleAnimation(uBorderIntensity, uBorderOpacity)

        this.mesh.name = projectData.title

        // 3. 펄스 효과용 지오메트리 캐싱
        this.pulseGeometry = new TorusGeometry(6, 0.08, 16, 128)

        // 4. UI 및 트리거 초기화
        this.hud = new ProjectHUD(projectData)

        // TriggerRegion 경로 주의: 같은 폴더 내 Area 폴더에 있다면 아래 경로가 맞습니다.
        this.trigger = new TriggerRegion(
            projectData.position,
            new Vector3(12, 12, 12),
            projectData.title,
            0x00ffff,
            false,
        )
    }

    async initialize(context: GameContext): Promise<void> {
        console.log(`[ProjectOutpost] Initializing: ${this.projectData.title}`)
        this.context = context
        context.scene.add(this.mesh)
        await this.trigger.initialize(context)

        this.mesh.add(this.hud.container)
        this.hud.container.position.set(0, 5, 0)

        this.trigger.on("enter", () => {
            console.log(`[ProjectOutpost] Enter: ${this.projectData.title}`)
            this.animateTransition(true)
            this.hud.show()
            this.hud.setInteractionReady(true)
            this.startPulseEffect()
        })

        this.trigger.on("exit", () => {
            console.log(`[ProjectOutpost] Exit: ${this.projectData.title}`)
            this.animateTransition(false)
            this.hud.hide()
            this.hud.setInteractionReady(false)
            this.stopPulseEffect()
        })
    }

    /**
     * 대기 상태에서 선의 Blooming 효과가 숨쉬듯 움직이는 애니메이션
     * Node 타입을 사용하여 구체적인 UniformNode 타입 에러 회피
     */
    private startIdleAnimation(uIntensity: any, uOpacity: any) {
        // 빛의 강도(Intensity)가 1.5 ~ 6.0 사이를 오감
        this.idleTween = gsap.to(uIntensity, {
            value: 6.0,
            duration: 2.0,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        })

        // 투명도 애니메이션
        gsap.to(uOpacity, {
            value: 0.6,
            duration: 2.0,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        })
    }

    private animateTransition(isEnter: boolean) {
        if (isEnter) {
            gsap.to(this.floorPlane.scale, {
                x: 1.2,
                y: 1.2,
                duration: 0.6,
                ease: "power2.out",
            })
            gsap.to(this.floorPlane.material, { opacity: 0.15, duration: 0.6 })
            // 테두리도 같이 커짐
            gsap.to(this.idleBorderMesh.scale, {
                x: 1.2,
                y: 1.2,
                duration: 0.6,
                ease: "power2.out",
            })
        } else {
            gsap.to(this.floorPlane.scale, {
                x: 1,
                y: 1,
                duration: 0.4,
                ease: "power2.in",
            })
            gsap.to(this.floorPlane.material, { opacity: 0, duration: 0.4 })
            // 테두리 원복
            gsap.to(this.idleBorderMesh.scale, {
                x: 1,
                y: 1,
                duration: 0.4,
                ease: "power2.in",
            })
        }
    }

    private startPulseEffect() {
        if (this.pulseTween) return

        this.pulseTween = gsap.to(
            {},
            {
                duration: 0.4,
                repeat: -1,
                onRepeat: () => this.spawnPulseRing(),
                onStart: () => this.spawnPulseRing(),
            },
        )
    }

    private stopPulseEffect() {
        if (this.pulseTween) {
            this.pulseTween.kill()
            this.pulseTween = null
        }
    }

    private spawnPulseRing() {
        const uColor = uniform(new Color(0x00ffff))
        const uOpacity = uniform(0)
        const uIntensity = uniform(1.0)

        const material = new MeshBasicNodeMaterial()
        material.transparent = true
        material.depthWrite = false
        material.depthTest = false
        material.colorNode = vec3(uColor).mul(uIntensity)
        material.opacityNode = uOpacity

        const ring = new Mesh(this.pulseGeometry, material)
        ring.rotation.x = -Math.PI / 2
        ring.position.set(0, 0, 0)
        ring.renderOrder = 999

        ring.scale.set(1.2, 1.2, 1.2)

        this.mesh.add(ring)

        const lifeTime = 2.0

        gsap.to(ring.position, {
            y: 2.5,
            duration: lifeTime,
            ease: "none",
        })

        gsap.to(ring.scale, {
            x: 1.3,
            y: 1.3,
            duration: lifeTime,
            ease: "power1.out",
        })

        const tl = gsap.timeline({
            onComplete: () => {
                this.mesh.remove(ring)
                material.dispose()
            },
        })

        tl.to(uOpacity, { value: 0.8, duration: 0.4, ease: "power2.out" }, 0)
        tl.to(uIntensity, { value: 15.0, duration: 0.4, ease: "power2.out" }, 0)
        tl.to(
            uOpacity,
            { value: 0, duration: lifeTime - 0.4, ease: "power2.in" },
            0.4,
        )
        tl.to(
            uIntensity,
            { value: 1.0, duration: lifeTime - 0.4, ease: "power2.in" },
            0.4,
        )
    }

    setTrackingTarget(shipBody: any) {
        if (!shipBody) return
        this.trigger.setTargetBody(shipBody)
    }

    get data(): ProjectData {
        return this.projectData
    }
    get isInside(): boolean {
        return this.trigger.isActive
    }

    update(deltaTime: number): void {
        this.trigger.update(deltaTime)

        if (!this.mesh.position.equals(this.projectData.position)) {
            this.mesh.position.copy(this.projectData.position)
            this.mesh.position.y = 0.05
            this.trigger.setPosition(this.projectData.position)
        }
    }

    dispose(): void {
        this.stopPulseEffect()
        if (this.idleTween) this.idleTween.kill()

        this.pulseGeometry.dispose()

        if (this.context) {
            this.context.scene.remove(this.mesh)
        }
        this.trigger.dispose()
    }

    public setOnInteraction(callback: () => void) {
        this.hud.onInteract(callback)
    }
}

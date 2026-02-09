import gsap from "gsap"
import {
    uniform,
    vec3,
} from "three/tsl"
import {
    CircleGeometry,
    Color,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshBasicNodeMaterial,
    TorusGeometry,
    Vector3,
} from "three/webgpu"
import { inject, injectable } from "inversify"

import type { ProjectData } from "@/core/ProjectRegistry"
import { ProjectHUD } from "../UI/ProjectHUD"
import { TriggerRegion } from "./Area/TriggerRegion"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { ISceneManager } from "@/Services/ISceneManager"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import type { Audio } from "@/Environment/Audio"
import type { IGameObject } from "../Services/IGameObject"
import type { RigidBody } from "@dimforge/rapier3d-compat"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"

@injectable()
export class ProjectOutpost implements IGameObject {
    private trigger!: TriggerRegion
    private hud!: ProjectHUD
    private mesh: Group = new Group()

    private floorPlane!: Mesh
    private idleBorderMesh!: Mesh

    // Animation control
    private pulseTween: gsap.core.Tween | null = null
    private idleTween: gsap.core.Tween | null = null

    private pulseGeometry!: TorusGeometry

    private projectData!: ProjectData
    private isSetup: boolean = false

    constructor(
        @inject(GAME_CONTEXT.MANAGER.SceneManager) private readonly sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.PhysicsService) private readonly physicsService: IPhysicsService,
        @inject(GAME_CONTEXT.CORE.Audio) private readonly audio: Audio,
        @inject(GAME_CONTEXT.CORE.EventBus) private readonly eventBus: EventBus,
    ) {
    }

    public setup(projectData: ProjectData): void {
        this.projectData = projectData
        this.mesh.position.copy(projectData.position)
        this.mesh.position.y = 0.05
        this.mesh.name = projectData.title

        this.setupVisuals()
        this.setupHUD()
        this.setupTrigger()

        this.isSetup = true
    }

    private setupVisuals(): void {
        // 1. Floor Plane
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

        // 2. Idle Border
        const borderGeo = new TorusGeometry(radius, 0.1, 16, 128)
        const uBorderColor = uniform(new Color(0x00ffff))
        const uBorderOpacity = uniform(0.3)
        const uBorderIntensity = uniform(1.5)

        const borderMat = new MeshBasicNodeMaterial()
        borderMat.transparent = true
        borderMat.depthWrite = false
        borderMat.depthTest = false
        borderMat.colorNode = vec3(uBorderColor).mul(uBorderIntensity)
        borderMat.opacityNode = uBorderOpacity

        this.idleBorderMesh = new Mesh(borderGeo, borderMat)
        this.idleBorderMesh.rotation.x = -Math.PI / 2
        this.idleBorderMesh.renderOrder = 999
        this.mesh.add(this.idleBorderMesh)

        this.startIdleAnimation(uBorderIntensity, uBorderOpacity)

        // 3. Pulse Geometry Cache
        this.pulseGeometry = new TorusGeometry(6, 0.08, 16, 128)
    }

    private setupHUD(): void {
        this.hud = new ProjectHUD(this.projectData)
        this.mesh.add(this.hud.container)
        this.hud.container.position.set(0, 5, 0)
    }

    private setupTrigger(): void {
        this.trigger = new TriggerRegion(
            this.projectData.position,
            new Vector3(12, 12, 12),
            this.projectData.title,
            0x00ffff,
            false,
        )
    }

    async initialize(addToScene: boolean = true): Promise<void> {
        if (!this.isSetup) {
            console.error("[ProjectOutpost] setup() must be called before initialize()")
            return
        }

        console.log(`[ProjectOutpost] Initializing: ${this.projectData.title}`)

        if (addToScene) {
            this.sceneManager.add(this.mesh)
        }

        await this.trigger.initialize(this.audio, this.physicsService, this.sceneManager)

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

        this.hud.onInteract(() => {
            this.eventBus.emit(GameEvents.PROJECT_INTERACTION_REQUESTED, {
                project: this.projectData,
            })
        })
    }

    private startIdleAnimation(uIntensity: any, uOpacity: any) {
        this.idleTween = gsap.to(uIntensity, {
            value: 6.0,
            duration: 2.0,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
        })

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
                // Check if mesh still exists/part of scene to avoid errors?
                if (this.mesh) {
                   this.mesh.remove(ring)
                }
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

    setTrackingTarget(shipBody: RigidBody) {
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
    }

    dispose(): void {
        this.stopPulseEffect()
        if (this.idleTween) this.idleTween.kill()

        this.pulseGeometry.dispose()

        if (this.sceneManager) {
            this.sceneManager.remove(this.mesh)
        }
        if (this.trigger) {
            this.trigger.dispose()
        }
    }

    public setOnInteraction(callback: () => void) {
        this.hud.onInteract(callback)
    }
}

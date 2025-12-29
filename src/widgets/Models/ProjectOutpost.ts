import gsap from "gsap"
import * as THREE from "three"
import type { GameContext, IGameObject } from "@/core/GameContext"
import type { ProjectData } from "@/core/ProjectRegistry"
import { ProjectHUD } from "../UI/ProjectHUD"
import { TriggerRegion } from "./Area/TriggerRegion"

export class ProjectOutpost implements IGameObject {
	private trigger: TriggerRegion
	private hud: ProjectHUD
	private mesh: THREE.Group
	private floorPlane: THREE.Mesh
	private borderLines: THREE.LineSegments
	private context: GameContext | null = null

	constructor(private projectData: ProjectData) {
		this.mesh = new THREE.Group()
		this.mesh.position.copy(projectData.position)
		this.mesh.position.y = 0.05

		const planeGeo = new THREE.PlaneGeometry(12, 12)
		const planeMat = new THREE.MeshBasicMaterial({
			color: 0x00ffff,
			transparent: true,
			opacity: 0,
			side: THREE.DoubleSide,
			depthWrite: false,
		})
		this.floorPlane = new THREE.Mesh(planeGeo, planeMat)
		this.floorPlane.rotation.x = -Math.PI / 2
		this.mesh.add(this.floorPlane)

		const edgesGeo = new THREE.EdgesGeometry(planeGeo)
		const borderMat = new THREE.LineBasicMaterial({
			color: 0x00ffff,
			transparent: true,
			opacity: 0.3,
		})
		this.borderLines = new THREE.LineSegments(edgesGeo, borderMat)
		this.borderLines.rotation.x = -Math.PI / 2
		this.mesh.add(this.borderLines)

		this.hud = new ProjectHUD(projectData)
		this.trigger = new TriggerRegion(
			projectData.position,
			new THREE.Vector3(20, 20, 20),
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
		this.hud.container.position.set(0, 3, 0)

		this.trigger.on("enter", () => {
			console.log(`[ProjectOutpost] Enter: ${this.projectData.title}`)
			this.animateTransition(true)
			this.hud.show()
			this.hud.setInteractionReady(true)
		})

		this.trigger.on("exit", () => {
			console.log(`[ProjectOutpost] Exit: ${this.projectData.title}`)
			this.animateTransition(false)
			this.hud.hide()
			this.hud.setInteractionReady(false)
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
			gsap.to(this.borderLines.material, { opacity: 1, duration: 0.6 })
			gsap.to(this.borderLines.scale, {
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
			gsap.to(this.borderLines.material, { opacity: 0.3, duration: 0.4 })
			gsap.to(this.borderLines.scale, {
				x: 1,
				y: 1,
				duration: 0.4,
				ease: "power2.in",
			})
		}
	}

	setTrackingTarget(shipBody: any) {
		if (!shipBody) {
			console.error(
				`[ProjectOutpost] Attempted to set null tracking target for ${this.projectData.title}`,
			)
			return
		}
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

		// Update logic for interaction removed
	}

	dispose(): void {
		if (this.context) {
			this.context.scene.remove(this.mesh)
		}
		this.trigger.dispose()
	}
}

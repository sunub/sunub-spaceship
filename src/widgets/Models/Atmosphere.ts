import * as THREE from "three"
import type { GameContext } from "@/core/GameContext"
import { CloudMaterial } from "../Materials/CloudMaterial"
import { BaseModel } from "./BaseModel"

export class Atmosphere extends BaseModel {
	private material: CloudMaterial | null = null

	constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
		super("atmosphereModel", position)
		this.position = position
	}

	async initialize(context: GameContext): Promise<void> {
		this.context = context

		this.material = new CloudMaterial({
			side: THREE.DoubleSide,
		})

		await super.initialize(context)
	}

	protected setupModelStructure(clonedModel: THREE.Object3D): void {
		super.setupModelStructure(clonedModel)

		this.mesh?.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.material = this.material
			}
		})
		this.mesh?.scale.set(2, 2, 2)
	}

	update(_deltaTime: number): void {
		if (this.context && this.modelGroup) {
			const elapsedTime = this.context.time.elapsed * 0.001 // ms to s
			this.modelGroup.rotation.y = elapsedTime * 0.05
			this.modelGroup.position.y =
				this.position.y + Math.sin(elapsedTime * 0.2) * 0.2

			if (this.material) {
				this.material.uTime = elapsedTime
			}
		}
	}

	dispose(): void {
		this.material?.dispose()
		super.dispose()
	}
}

import * as THREE from "three"
import type { GameContext, IGameObject } from "@/core/GameContext"
// import { vertexShader, fragmentShader } from '../Shader/EngineFlameShader';
import { TweakPane } from "@/widgets/TweakPane"
import { EngineFlameMaterial } from "./Shader/EngineFlameMaterial"

export class EngineFlame implements IGameObject {
	private context: GameContext | null = null
	public modelGroup: THREE.Group
	// private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
	// private material: THREE.ShaderMaterial | null = null;
	private mesh: THREE.Mesh | null = null
	private material: EngineFlameMaterial | null = null

	constructor(position: THREE.Vector3 = new THREE.Vector3(0, 2, 0)) {
		this.modelGroup = new THREE.Group()
		this.modelGroup.position.copy(position)
	}

	async initialize(context: GameContext): Promise<void> {
		this.context = context
		// Temporary fix for WebGPU compatibility
		this.material = new EngineFlameMaterial()

		const geometry = new THREE.BoxGeometry(1.0, 10.0, 1.0)

		this.mesh = new THREE.Mesh(geometry, this.material)
		this.mesh.scale.set(0.75, 0.4, 0.5)
		// this.mesh.rotation.x = Math.PI / 2; // 회전 제거 혹은 필요시 로컬 회전만 적용

		this.modelGroup.add(this.mesh)
		this.mesh.frustumCulled = false
	}

	public setupTweakPane() {
		if (!this.material) return

		const pane = TweakPane.getInstance()
		const f = pane.addFolder({
			title: "Engine Flame Material",
			expanded: true,
		})

		// Main Color
		f.addBinding(this.material.uMainColor, "value", {
			label: "Main Color",
			color: { type: "float" }, // 필요시 타입 명시
		})

		// Base Color
		f.addBinding(this.material.uBaseColor, "value", {
			label: "Base Color",
			color: { type: "float" },
		})

		// Thrust (number 타입 Uniform)
		// UniformNode 객체의 'value' 키를 바인딩합니다.
		f.addBinding(this.material.uThrust, "value", {
			min: 0,
			max: 1,
			step: 0.01,
			label: "Thrust",
		})

		// Flame Length
		f.addBinding(this.material.uFlameLength, "value", {
			min: 0,
			max: 2.0,
			step: 0.01,
			label: "Flame Length",
		})

		// Transform 바인딩 (기존 유지)
		f.addBinding(this.modelGroup.rotation, "x", {
			min: -Math.PI,
			max: Math.PI,
			step: 0.01,
			label: "Rotation X",
		})
		f.addBinding(this.modelGroup.rotation, "y", {
			min: -Math.PI,
			max: Math.PI,
			step: 0.01,
			label: "Rotation Y",
		})
		f.addBinding(this.modelGroup.rotation, "z", {
			min: -Math.PI,
			max: Math.PI,
			step: 0.01,
			label: "Rotation Z",
		})

		f.addBinding(this.modelGroup.position, "x", {
			min: -10,
			max: 10,
			step: 0.01,
			label: "Position X",
		})
		f.addBinding(this.modelGroup.position, "y", {
			min: -10,
			max: 10,
			step: 0.01,
			label: "Position Y",
		})
		f.addBinding(this.modelGroup.position, "z", {
			min: -10,
			max: 10,
			step: 0.01,
			label: "Position Z",
		})
	}

	public setColor(mainColor: string | number, baseColor?: string | number) {
		if (this.material) {
			this.material.uMainColor.value.set(mainColor)

			if (baseColor) {
				this.material.uBaseColor.value.set(baseColor)
			}
		}
	}

	public setThrust(level: number) {
		if (this.material) {
			this.material.uThrust.value = level
		}
	}

	public setFlameLength(length: number) {
		if (this.material) {
			this.material.uFlameLength.value = length
		}
	}

	public update(_deltaTime: number): void {
		if (this.context && this.material) {
			const elapsedTime = this.context.time.elapsed * 0.001

			this.material.uTime.value = elapsedTime

			if (!this.context.camera || !this.context.camera.instance) return

			if (this.mesh) {
				this.mesh.updateWorldMatrix(true, false)

				const cameraWorldPos =
					this.context.camera.instance.position.clone()
				const worldToLocal = this.mesh.matrixWorld.clone().invert()

				const cameraLocalPos = cameraWorldPos.applyMatrix4(worldToLocal)

				this.material.uLocalCameraPos.value.copy(cameraLocalPos)
			}
		}
	}

	dispose(): void {
		if (this.mesh) {
			this.context?.scene.remove(this.mesh)
			this.mesh.geometry.dispose()
		}
		this.material?.dispose()
	}
}

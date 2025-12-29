import * as THREE from "three/webgpu"
import { GrassMaterial } from "@/widgets/Materials/GrassMaterial"
import type { GrassMaterialOptions } from "@/widgets/Materials/GrassMaterial/GrassMaterial"

export interface GrassOptions extends GrassMaterialOptions {
	count?: number
	areaSize?: number
}

export class Grass {
	mesh: THREE.Mesh | null = null
	geometry: THREE.InstancedBufferGeometry | null = null
	material: GrassMaterial | null = null

	public params: Required<GrassOptions> = {
		width: 0.1,
		height: 1.0,
		segments: 5,
		patchSize: 1.0,
		count: 20000,
		areaSize: 200.0,
		interactionRadius: 3.0,
	}

	private time: number = 0

	constructor(options: GrassOptions = {}) {
		this.params = { ...this.params, ...options }
		this.init()
	}

	private init() {
		this.setGeometry()
		this.setMaterial()
		this.setMesh()
	}

	private setGeometry() {
		const segments = this.params.segments
		const vertices = (segments + 1) * 2
		const indices: number[] = []

		for (let i = 0; i < segments; ++i) {
			const vi = i * 2
			indices[i * 12 + 0] = vi + 0
			indices[i * 12 + 1] = vi + 1
			indices[i * 12 + 2] = vi + 2

			indices[i * 12 + 3] = vi + 2
			indices[i * 12 + 4] = vi + 1
			indices[i * 12 + 5] = vi + 3

			const fi = vertices + vi
			indices[i * 12 + 6] = fi + 2
			indices[i * 12 + 7] = fi + 1
			indices[i * 12 + 8] = fi + 0

			indices[i * 12 + 9] = fi + 3
			indices[i * 12 + 10] = fi + 1
			indices[i * 12 + 11] = fi + 2
		}

		this.geometry = new THREE.InstancedBufferGeometry()
		this.geometry.instanceCount = 0
		this.geometry.setIndex(indices)
		// Use WebGPU specific classes if needed, but standard geometry works
		this.geometry.boundingSphere = new THREE.Sphere(
			new THREE.Vector3(0, 0, 0),
			Infinity,
		)

		const positions = new Float32Array(this.params.count * 3)
		this.geometry.setAttribute(
			"aInstancePosition",
			new THREE.InstancedBufferAttribute(positions, 3),
		)
	}

	private setMaterial() {
		this.material = new GrassMaterial({
			segments: this.params.segments,
			patchSize: this.params.patchSize,
			width: this.params.width,
			height: this.params.height,
			interactionRadius: this.params.interactionRadius,
		})
	}

	private setMesh() {
		if (this.geometry && this.material) {
			this.mesh = new THREE.Mesh(this.geometry, this.material)
			this.mesh.frustumCulled = false
		}
	}

	update(deltaTime: number, playerPosition?: THREE.Vector3) {
		this.time += deltaTime
		if (this.material) {
			this.material.time = this.time * 0.001

			if (playerPosition) {
				this.material.playerPosition = playerPosition
			}
		}
	}

	updateInteractionRadius(radius: number) {
		this.params.interactionRadius = radius
		if (this.material) {
			this.material.interactionRadius = radius
		}
	}

	updateParams(params: Partial<GrassOptions>) {
		this.params = { ...this.params, ...params }
		if (this.material) {
			this.material.setGrassParams(
				this.params.segments,
				this.params.patchSize,
				this.params.width,
				this.params.height,
			)
		}
	}

	plantAtPositions(
		locations: { x: number; z: number }[],
		densityPerPatch: number = 20,
	) {
		if (!this.geometry) return

		const totalNeeded = locations.length * densityPerPatch
		if (totalNeeded > this.params.count) {
			console.warn(
				`Grass limit reached. Needed: ${totalNeeded}, Max: ${this.params.count}. Truncating.`,
			)
		}

		const attribute = this.geometry.getAttribute(
			"aInstancePosition",
		) as THREE.InstancedBufferAttribute
		const array = attribute.array as Float32Array

		const patchRadius = this.params.patchSize * 0.5

		let index = 0

		for (const loc of locations) {
			for (let i = 0; i < densityPerPatch; i++) {
				if (index >= this.params.count) break

				const angle = Math.random() * Math.PI * 2
				const r = Math.sqrt(Math.random()) * patchRadius

				const xStr = r * Math.cos(angle)
				const zStr = r * Math.sin(angle)

				const wx = loc.x + xStr
				const wz = loc.z + zStr
				const wy = 0

				array[index * 3 + 0] = wx
				array[index * 3 + 1] = wy
				array[index * 3 + 2] = wz

				index++
			}
		}

		this.geometry.instanceCount = index
		attribute.needsUpdate = true
	}
}

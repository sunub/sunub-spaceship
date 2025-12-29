import { color } from "three/tsl"
import * as THREE from "three/webgpu"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"

export function Balls() {}

Balls.initialize = Balls_initialize

export function Balls_initialize(
	position: THREE.Vector3,
	colorInput: string | number,
) {
	const geometry = new THREE.SphereGeometry(1, 64, 64)

	const material = new MeshDefaultMaterial({
		colorNode: color(colorInput as any),
		hasCoreShadows: true,
		hasDropShadows: true,
	})

	const mesh = new THREE.Mesh(geometry, material)
	mesh.castShadow = true
	mesh.receiveShadow = true
	mesh.position.copy(position)
	return mesh
}

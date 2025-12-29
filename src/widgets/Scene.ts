import * as THREE from "three"

export class Scene extends THREE.Scene {
	addScene(object: THREE.Object3D[]) {
		for (const obj of object) {
			this.add(obj)
		}
	}

	removeScene(object: THREE.Object3D[]) {
		for (const obj of object) {
			this.remove(obj)
		}
	}
}

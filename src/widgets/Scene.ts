import type { Object3D } from "three/webgpu"
import { Scene as THREESCENE } from "three/webgpu"

export class Scene extends THREESCENE {
    addScene(object: Object3D[]) {
        for (const obj of object) {
            this.add(obj)
        }
    }

    removeScene(object: Object3D[]) {
        for (const obj of object) {
            this.remove(obj)
        }
    }
}

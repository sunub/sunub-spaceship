import type { Object3D } from "three/webgpu"

export interface ISceneManager {
    add(object: Object3D): void
    remove(object: Object3D): void
    getObjectByName(name: string): Object3D | undefined
}

import type { Object3D } from "three/webgpu"
import { Scene as THREESCENE } from "three/webgpu"
import type { ISceneManager } from "../Services/ISceneManager"

export class Scene extends THREESCENE implements ISceneManager {
    getObjectByName(name: string): Object3D | undefined {
        return super.getObjectByName(name) || undefined
    }
}

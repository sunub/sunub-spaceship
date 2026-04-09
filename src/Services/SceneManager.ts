import { inject, injectable } from "inversify"
import type { Object3D } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Scene } from "../core/Scene"

@injectable()
export class SceneManager {
    constructor(@inject(GAME_CONTEXT.CORE.Scene) private scene: Scene) {}

    add(object3D: Object3D) {
        this.scene.add(object3D)
    }

    remove(object3D: Object3D) {
        this.scene.remove(object3D)
    }

    getObjectByName(name: string): Object3D | undefined {
        return this.scene.getObjectByName(name)
    }
}

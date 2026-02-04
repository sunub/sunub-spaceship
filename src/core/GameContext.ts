import type * as RAPIER from "@dimforge/rapier3d-compat"
import type { Audio } from "@/widgets/Audio"
import type { Game } from "@/widgets/Game"
import type { Lighting } from "@/widgets/Lighting"
import type { InputManager } from "../Inputs/InputManager"
import type Resources from "../utils/Resources"
import type { Size } from "../utils/Size"
import type Time from "../utils/Time"
import type { Camera } from "../widgets/Camera"
import type { CSSRenderer } from "../widgets/CSSRenderer"
import type { Debug } from "../widgets/Debug"
import type { Physics } from "../widgets/Physics"
import type { Rendering } from "../widgets/Rendering"
import type { Scene } from "../widgets/Scene"

export interface GameContext {
    cssRenderer: CSSRenderer
    rendering: Rendering
    scene: Scene
    camera: Camera
    physics: Physics
    time: Time
    size: Size
    debug: Debug
    inputManager: InputManager
    resources: Resources
    lighting: Lighting
    rapier: typeof RAPIER
    audio: Audio
    game: Game
}

export interface IGameObject {
    initialize?(context: GameContext): void | Promise<void>
    update(deltaTime: number): void
    updatePhysics?(deltaTime: number): void
    dispose?(): void
}

export interface IController {
    update(): void
    enabled: boolean
}

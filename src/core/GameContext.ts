import type { InputManager } from "../Inputs/InputManager"
import type Resources from "../utils/Resources"
import type { Size } from "../utils/Size"
import type Time from "../utils/Time"
import type { Camera } from "../widgets/Camera"
import type { Debug } from "../widgets/Debug"
import type { Physics } from "../widgets/Physics"
import type { Renderer } from "../widgets/Renderer"
import type { Scene } from "../widgets/Scene"

export interface GameContext
{
	renderer: Renderer
	scene: Scene
	camera: Camera
	physics: Physics
	time: Time
	size: Size
	debug: Debug
	inputManager: InputManager
	resources: Resources
}

export interface IGameObject
{
	initialize?(context: GameContext): void | Promise<void>
	update(deltaTime: number): void
	dispose?(): void
}

export interface IController
{
	update(): void
	enabled: boolean
}

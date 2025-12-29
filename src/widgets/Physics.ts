import RAPIER from "@dimforge/rapier3d-compat"
import EventEmitter from "../utils/EventEmitter"
import { PhysicsDebug } from "./PhysicsDebug"

const GRAVITY = { x: 0.0, y: -9.81, z: 0.0 }

export class Physics extends EventEmitter {
	world!: RAPIER.World
	private debug!: PhysicsDebug
	private isInitialized = false

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}

		this.world = new RAPIER.World(GRAVITY)
		this.debug = new PhysicsDebug(this.world)
		this.isInitialized = true
	}

	step(): void {
		if (this.isInitialized) {
			this.world.step()
		}
	}

	update(): void {
		if (this.isInitialized) {
			this.debug.update()
		}
	}
}

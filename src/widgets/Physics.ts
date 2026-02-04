import * as RAPIER from "@dimforge/rapier3d-compat"
import type { GameContext } from "@/core/GameContext"
import { PhysicsDebug } from "./PhysicsDebug"

const GRAVITY = { x: 0.0, y: -9.81, z: 0.0 }

export class Physics {
    world!: RAPIER.World
    private debug!: PhysicsDebug
    private isInitialized = false
    
    public rapier!: typeof RAPIER | null

    public setupRapier(initializedRapier: typeof RAPIER) {
        this.rapier = initializedRapier
    }

    async initialize(_context: GameContext): Promise<void> {
        if(!this.rapier) {
            throw new Error("setupRapier must be called before initialize")
        }

        this.world = new this.rapier.World(GRAVITY)
        this.debug = new PhysicsDebug(this.world)
        this.isInitialized = true
        // 디버깅 기능
        // context.scene.add(this.debug.lineSegments)
    }

    step(timestep?: number): void {
        if (this.isInitialized) {
            if (timestep) {
                this.world.timestep = timestep
            }
            this.world.step()
        }
    }

    update(): void {
        if (this.isInitialized) {
            this.debug.update()
        }
    }
}

import { inject, injectable } from "inversify"
import type { Camera } from "@/Camera"
import type { CSSRenderer } from "@/core/CSSRenderer"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Entry } from "@/core/Entry"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"
import type { Lighting } from "@/core/Lighting"
import type { Physics } from "@/core/Physics"
import type { Rendering } from "@/core/Rendering"
import type { Scene } from "@/core/Scene"
import type { ProjectManager } from "@/Manager/ProjectManager"
import type { WorldManager } from "@/Manager/WorldManager"
import type { TerrainVisibilityArea } from "@/Services/TerrainVisibilityArea"
import type Time from "@/utils/Time"
import type {
    GameLoopPhaseContext,
    GameLoopPhaseDefinition,
} from "./GameLoopPhase"

export type GameLoopMode = "entry" | "transition" | "full"

@injectable()
export class GameLoop {
    private isRunning = false
    private shouldResetTime = false
    private entryDisposed = false
    private mode: GameLoopMode = "entry"
    private readonly phases: ReadonlyArray<GameLoopPhaseDefinition>

    constructor(
        @inject(GAME_CONTEXT.UTILITY.Time) private time: Time,
        @inject(GAME_CONTEXT.CORE.Physics) private physics: Physics,
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
        @inject(GAME_CONTEXT.MANAGER.WorldManager)
        private worldManager: WorldManager,
        @inject(GAME_CONTEXT.MANAGER.ProjectManager)
        private projectManager: ProjectManager,
        @inject(GAME_CONTEXT.CORE.Lighting) private lighting: Lighting,
        @inject(GAME_CONTEXT.CORE.CSSRenderer) private cssRenderer: CSSRenderer,
        @inject(GAME_CONTEXT.CORE.Scene) private scene: Scene,
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Entry) private entry: Entry,
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
        @inject(GAME_CONTEXT.SERVICE.TerrainVisibilityArea)
        private terrainVisibilityArea: TerrainVisibilityArea,
    ) {
        this.eventBus.on(GameEvents.GAME_VISIBILITY_VISIBLE, () => {
            this.resetTime()
        })
        this.eventBus.on(GameEvents.ENTRY_DISPOSED, () => {
            this.markEntryDisposed()
        })
        this.phases = this.createPhases()
    }

    public start(mode: GameLoopMode = "entry") {
        if (this.isRunning) {
            return
        }
        this.isRunning = true
        this.mode = mode
        this.terrainVisibilityArea.initialize()
        this.rendering.renderer.setAnimationLoop(this.loop.bind(this))
    }

    public setMode(mode: GameLoopMode) {
        this.mode = mode
    }

    public stop() {
        this.isRunning = false
        this.rendering.renderer.setAnimationLoop(null)
    }

    /**
     * Entry가 dispose된 후 Entry.update() 호출을 완전히 스킵합니다.
     * LoadingAnimation의 InstancedMesh 매트릭스 + GPU 업로드를 제거하여 프레임 확보.
     */
    public markEntryDisposed(): void {
        this.entryDisposed = true
    }

    public resetTime() {
        this.shouldResetTime = true
    }

    private loop(time: number) {
        if (!this.isRunning) return

        if (this.shouldResetTime) {
            this.time.reset(time)
            this.shouldResetTime = false
        }
        this.time.update(time)
        this.update()
    }

    private update() {
        const context = this.createPhaseContext()

        try {
            this.runPhases(context)
        } catch (error) {
            console.error("Game Loop Error:", error)
        }
    }

    private createPhaseContext(): GameLoopPhaseContext {
        return {
            // Delta limiting (Max 20FPS)
            deltaTime: Math.min(this.time.delta * 0.001, 0.05),
            isFullMode: this.mode === "full",
            isTransitioning: this.camera.isTransitioning,
            entryDisposed: this.entryDisposed,
        }
    }

    private createPhases(): ReadonlyArray<GameLoopPhaseDefinition> {
        return [
            {
                name: "lighting",
                run: () => {
                    this.lighting.update()
                },
            },
            {
                name: "physics",
                shouldRun: ({ isFullMode, isTransitioning }) =>
                    isFullMode && !isTransitioning,
                run: ({ deltaTime }) => {
                    this.worldManager.updatePhysics(deltaTime)
                    this.physics.step(deltaTime)
                },
            },
            {
                name: "entry",
                shouldRun: ({ entryDisposed }) => !entryDisposed,
                run: ({ deltaTime }) => {
                    this.entry.update(deltaTime)
                },
            },
            {
                name: "logic",
                shouldRun: ({ isFullMode }) => isFullMode,
                run: ({ deltaTime }) => {
                    this.worldManager.update(deltaTime)
                    this.projectManager.update(deltaTime)
                },
            },
            {
                name: "camera",
                run: ({ deltaTime, isTransitioning }) => {
                    if (isTransitioning) {
                        this.camera.updateTransition(deltaTime)
                    } else {
                        this.camera.update()
                    }
                },
            },
            {
                name: "visibility",
                shouldRun: ({ isFullMode }) => isFullMode,
                run: ({ deltaTime }) => {
                    this.terrainVisibilityArea.update(deltaTime)
                },
            },
            {
                name: "visibility",
                shouldRun: ({ isFullMode }) => isFullMode,
                run: () => {
                    this.worldManager.syncVisibilityCulling()
                },
            },
            {
                name: "physicsDebug",
                shouldRun: ({ isFullMode }) => isFullMode,
                run: () => {
                    this.physics.update()
                },
            },
            {
                name: "render",
                run: () => {
                    this.rendering.update()
                },
            },
            {
                name: "cssRender",
                shouldRun: ({ isFullMode }) =>
                    isFullMode &&
                    Boolean(
                        this.cssRenderer && this.scene && this.camera.instance,
                    ),
                run: () => {
                    this.cssRenderer.render(this.scene, this.camera.instance)
                },
            },
        ]
    }

    private runPhases(context: GameLoopPhaseContext): void {
        for (const phase of this.phases) {
            if (phase.shouldRun && !phase.shouldRun(context)) {
                continue
            }

            phase.run(context)
        }
    }
}

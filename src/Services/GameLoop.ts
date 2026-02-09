
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type Time from "@/utils/Time"
import type { Physics } from "@/core/Physics"
import type { Rendering } from "@/core/Rendering"
import type { WorldManager } from "@/Manager/WorldManager"
import type { ProjectManager } from "@/Manager/ProjectManager"
import type { Lighting } from "@/core/Lighting"
import type { CSSRenderer } from "@/core/CSSRenderer"
import type { Scene } from "@/core/Scene"
import type { Camera } from "@/Camera"
import type { Entry } from "@/core/Entry"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"
import type { TerrainVisibilityArea } from "@/Services/TerrainVisibilityArea"

@injectable()
export class GameLoop {
    private isRunning = false
    private isRendering = false
    private shouldResetTime = false
    private entryDisposed = false

    constructor(
        @inject(GAME_CONTEXT.UTILITY.Time) private time: Time,
        @inject(GAME_CONTEXT.CORE.Physics) private physics: Physics,
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
        @inject(GAME_CONTEXT.MANAGER.WorldManager) private worldManager: WorldManager,
        @inject(GAME_CONTEXT.MANAGER.ProjectManager) private projectManager: ProjectManager,
        @inject(GAME_CONTEXT.CORE.Lighting) private lighting: Lighting,
        @inject(GAME_CONTEXT.CORE.CSSRenderer) private cssRenderer: CSSRenderer,
        @inject(GAME_CONTEXT.CORE.Scene) private scene: Scene,
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Entry) private entry: Entry,
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
        @inject(GAME_CONTEXT.SERVICE.TerrainVisibilityArea) private terrainVisibilityArea: TerrainVisibilityArea,
    ) {
        this.eventBus.on(GameEvents.GAME_VISIBILITY_VISIBLE, () => {
            this.resetTime()
        })
        this.eventBus.on(GameEvents.ENTRY_DISPOSED, () => {
            this.markEntryDisposed()
        })
    }

    public start() {
        if (this.isRunning) {
            return
        }
        this.isRunning = true
        this.terrainVisibilityArea.initialize()
        this.rendering.renderer.setAnimationLoop(this.loop.bind(this))
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

    private async update() {
        if (this.isRendering) {
            return
        }
        this.isRendering = true

        // Delta limiting (Max 20FPS)
        const deltaTime = Math.min(this.time.delta * 0.001, 0.05)

        try {
            this.lighting.update()

            // Physics Phase: 전환 중이 아닐 때만 전체 물리 스텝 실행
            if (!this.camera.isTransitioning) {
                this.worldManager.updatePhysics(deltaTime)
                this.physics.step(deltaTime)
            }

            // Entry Phase: dispose 후에는 스킵 (LoadingAnimation GPU 업로드 제거)
            if (!this.entryDisposed) {
                this.entry.update(deltaTime)
            }

            // Visibility Phase: 카메라 기반 가시 영역 계산 (Grass 등 최적화에 사용)
            this.terrainVisibilityArea.update(deltaTime)

            // Logic & Visual Phase: Sync visuals to physics bodies, animate, etc.
            this.worldManager.update(deltaTime)
            this.projectManager.update(deltaTime)

            // Camera Phase: 전환 보간을 GameLoop 틱에서 직접 수행 (GSAP rAF 이중 실행 제거)
            if (this.camera.isTransitioning) {
                this.camera.updateTransition(deltaTime)
            } else {
                this.camera.update()
            }

            this.physics.update() // Update Debug Visuals
            await this.rendering.update()

            if (this.cssRenderer && this.scene && this.camera.instance) {
                await this.cssRenderer.render(this.scene, this.camera.instance)
            }
        } catch (error) {
            console.error("Game Loop Error:", error)
        } finally {
            this.isRendering = false
        }
    }
}

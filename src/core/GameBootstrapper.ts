import { inject, injectable } from "inversify"
import type { Camera } from "@/Camera"
import type { Game } from "@/core/Game"
import type { Lighting } from "@/core/Lighting"
import type { Physics } from "@/core/Physics"
import type { Rendering } from "@/core/Rendering"
import type { Audio } from "@/Environment/Audio"
import type { EnvironmentManager } from "@/Manager/EnvironmentManager"
import type { WorldManager } from "@/Manager/WorldManager"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"
import type { GameLoop } from "@/Services/GameLoop"
import { entrySources, modelSources, textureSources } from "@/sources"
import type { Resources, Source } from "@/utils/Resources"
import { GAME_CONTEXT } from "./DI/DITypes"
import type { DOMManager } from "./DOMManger"
import type { Entry } from "./Entry"

@injectable()
export class GameBootstrapper {
    constructor(
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
        @inject(GAME_CONTEXT.CORE.Lighting) private lighting: Lighting,
        @inject(GAME_CONTEXT.MANAGER.DOMManager) private domManager: DOMManager,
        @inject(GAME_CONTEXT.CORE.Game) private game: Game,
        @inject(GAME_CONTEXT.CORE.Entry) private entry: Entry,
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        private resourceService: Resources,
        @inject(GAME_CONTEXT.CORE.GameLoop) private gameLoop: GameLoop,
        @inject(GAME_CONTEXT.CORE.Physics) private physics: Physics,
        @inject(GAME_CONTEXT.CORE.Audio) private audio: Audio,
        @inject(GAME_CONTEXT.MANAGER.EnvironmentManager)
        private environmentManager: EnvironmentManager,
        @inject(GAME_CONTEXT.MANAGER.WorldManager)
        private worldManager: WorldManager,
    ) {}

    public async run() {
        console.log("🚀 System Booting...")
        this.resourceService.items = {}

        // Phase 1: 필수 시스템 초기화
        await this.rendering.setRenderer(this.domManager.canvas)
        await this.camera.initialize()
        this.rendering.setCamera(this.camera)
        this.lighting.initialize()
        this.audio.initCriticalAudio()

        await this.runSingleProcessMode()

        // MeshDefaultMaterial는 Floor(terrain) + Fog가 모두 준비되어 있어야 생성 가능합니다.
        // Terrain은 WorldManager에서 먼저 한 번만 초기화한 뒤, 나머지 오브젝트를 생성합니다.
        this.environmentManager.setup()
        await this.worldManager.prepareTerrain()
        this.worldManager.attachPreparedObjects()
        this.worldManager.setWorldVisibility(false)
        MeshDefaultMaterial.setup({
            lighting: this.lighting,
            terrian: this.worldManager.terrain,
            fog: this.environmentManager.fog,
        })

        // Phase 3: 게임 오브젝트 생성 및 환경 설정
        await this.game.prepareGameObjects({
            skipTerrainInitialization: true,
            stageSceneObjects: true,
        })
        this.game.setupEnvironment()

        // Phase 4: 시작 버튼 활성화 → 클릭 시 게임 시작
        this.entry.enableStartButton(async () => {
            this.entry.showPreparingLaunchState()
            this.gameLoop.setMode("transition")

            if (process.env.NODE_ENV !== "development") {
                // 버튼 효과음은 즉시 재생 (이미 초기화 완료)
                this.audio.play("button")
            }

            this.game.revealPreparedGameObjects()
            await this.waitForNextFrames(2)
            this.entry.dispose()

            // 카메라 전환 우선 실행 (프레임 확보가 최우선)
            await this.game.startGame()
            this.gameLoop.setMode("full")

            // 전환 완료 후 DOM 조작/이벤트 리스너 등록 수행
            // requestAnimationFrame으로 다음 렌더 프레임에 UI를 표시하여
            // 카메라 전환 이후 확실한 타이밍에 실행합니다.
            this.scheduleNonCriticalStartup(() => {
                this.audio.initNonCriticalAudio()
                this.audio.showDisplay()
                this.audio.showPanel()
                this.audio.handleSoundControl()
            })
        })
    }

    private async runSingleProcessMode() {
        const allSources = this.getAllSources()
        const entrySources = this.getEntrySources()

        const totalResources = allSources.length + entrySources.length

        const progress = this.createProgressTracker(totalResources)
        const createPhaseProgressHandler = (offset: number) => {
            return (loadCount: number) => {
                progress.update(offset + loadCount)
            }
        }

        await this.resourceService.load(
            entrySources,
            (loadedCount) => createPhaseProgressHandler(0)(loadedCount),
            {
                resourcePhase: "Entry Load",
            },
        )
        await this.entry.setupEntryScene()
        this.rendering.setPostProcessing()
        await this.rendering.preparePresentation()
        this.gameLoop.start("entry")

        const rapierModulePromise = import("@dimforge/rapier3d-compat")
        await this.resourceService.load(
            allSources,
            (loadedCount) =>
                createPhaseProgressHandler(entrySources.length)(loadedCount),
            {
                resourcePhase: "SingleProcess Load",
            },
        )

        const rapierModule = await rapierModulePromise
        await this.initializePhysics(rapierModule)
    }

    private createProgressTracker(totalCount: number) {
        let latestLoaded = 0
        return {
            update: (loadedCount: number) => {
                const nextLoaded = Math.min(loadedCount, totalCount)
                if (nextLoaded > latestLoaded) {
                    latestLoaded = nextLoaded
                    this.entry.updateProgressUI(latestLoaded, totalCount)
                }
            },
        }
    }

    private async initializePhysics(rapierModule: any) {
        await rapierModule.init()

        this.physics.setupRapier(rapierModule)
        await this.physics.initialize()
    }

    private getEntrySources(): Source[] {
        return entrySources
    }

    private getAllSources(): Source[] {
        return [...modelSources, ...textureSources]
    }

    private async waitForNextFrames(frameCount: number = 1): Promise<void> {
        for (let i = 0; i < frameCount; i++) {
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve())
            })
        }
    }

    private scheduleNonCriticalStartup(callback: () => void): void {
        const idleCallback = window.requestIdleCallback
        if (typeof idleCallback === "function") {
            idleCallback(() => callback(), { timeout: 500 })
            return
        }

        requestAnimationFrame(() => callback())
    }
}

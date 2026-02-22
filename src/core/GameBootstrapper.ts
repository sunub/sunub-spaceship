import { inject, injectable } from "inversify";
import { GAME_CONTEXT } from "./DI/DITypes";
import type { Camera } from "@/Camera";
import type { Rendering } from "@/core/Rendering";
import type { Lighting } from "@/core/Lighting";
import type { DOMManager } from "./DOMManger";
import type { Game } from "@/core/Game";
import type { Entry } from "./Entry";
import type { Resources } from "@/utils/Resources";
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial";
import { entrySources, modelSources, textureSources } from "@/sources";
import type { Physics } from "@/core/Physics";
import type { Audio } from "@/Environment/Audio";
import type { GameLoop } from "@/Services/GameLoop";
import type { EnvironmentManager } from "@/Manager/EnvironmentManager";
import type { WorldManager } from "@/Manager/WorldManager";
import { PerformanceTracker } from "@/utils/PerformanceTracker";
import type { Source } from "@/utils/Resources";

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
        PerformanceTracker.clear();
        console.log("🚀 System Booting...");
        this.resourceService.items = {};

        // Phase 1: 필수 시스템 초기화
        PerformanceTracker.startPhase("Boot");
        await this.rendering.setRenderer(this.domManager.canvas);
        await this.camera.initialize();
        this.rendering.setCamera(this.camera);
        this.lighting.initialize();
        PerformanceTracker.endPhase("Boot");
        this.audio.initCriticalAudio();

        // 기존 벤치마크/모드 토글 로직을 제거하고 single-process 고정 경로로 로드합니다.
        await this.runSingleProcessMode();

        PerformanceTracker.startPhase("PostProcessing");
        this.rendering.setPostProcessing();
        PerformanceTracker.endPhase("PostProcessing");

        // MeshDefaultMaterial는 Floor(terrain) + Fog가 모두 준비되어 있어야 생성 가능합니다.
        // Terrain은 WorldManager에서 먼저 한 번만 초기화한 뒤, 나머지 오브젝트를 생성합니다.
        PerformanceTracker.startPhase("Material Context");
        this.environmentManager.setup();
        await this.worldManager.prepareTerrain();
        MeshDefaultMaterial.setup({
            lighting: this.lighting,
            terrian: this.worldManager.terrain,
            fog: this.environmentManager.fog,
        });
        PerformanceTracker.endPhase("Material Context");

        // Phase 3: 게임 오브젝트 생성 및 환경 설정
        PerformanceTracker.startPhase("GameObject Setup");
        await this.game.prepareGameObjects({ skipTerrainInitialization: true });
        this.game.setupEnvironment();
        PerformanceTracker.endPhase("GameObject Setup");

        // 성능 리포트 출력 (모든 리소스 로딩 완료 후)
        PerformanceTracker.printReport();

        // Phase 4: 시작 버튼 활성화 → 클릭 시 게임 시작
        this.entry.enableStartButton(async () => {
            this.gameLoop.setMode("full");

            // 버튼 효과음은 즉시 재생 (이미 초기화 완료)
            this.audio.play("button");
            this.audio.initNonCriticalAudio();

            // 카메라 전환 우선 실행 (프레임 확보가 최우선)
            await this.game.startGame();

            // 전환 완료 후 DOM 조작/이벤트 리스너 등록 수행
            // requestAnimationFrame으로 다음 렌더 프레임에 UI를 표시하여
            // 카메라 전환 이후 확실한 타이밍에 실행합니다.
            requestAnimationFrame(() => {
                this.audio.showDisplay();
                this.audio.showPanel();
                this.audio.handleSoundControl();
            });
        });
    }

    private async runSingleProcessMode() {
        const allSources = this.getAllSources();
        const totalResources = allSources.length;
        const progress = this.createProgressTracker(totalResources);
        const handleProgress = (
            loadedCount: number,
            _totalCount: number,
            _info: unknown,
        ) => {
            progress.update(loadedCount);
        };

        PerformanceTracker.startPhase("SingleProcess Load");
        const rapierModulePromise = import("@dimforge/rapier3d-compat");

        await this.resourceService.load(allSources, handleProgress, {
            resourcePhase: "SingleProcess Load",
        });
        await this.entry.setupEntryScene();
        this.gameLoop.start("entry");
        PerformanceTracker.endPhase("SingleProcess Load");

        const rapierModule = await rapierModulePromise;
        await this.initializePhysics(rapierModule);
    }

    private createProgressTracker(totalCount: number) {
        let latestLoaded = 0;
        return {
            update: (loadedCount: number) => {
                const nextLoaded = Math.min(loadedCount, totalCount);
                if (nextLoaded > latestLoaded) {
                    latestLoaded = nextLoaded;
                    this.entry.updateProgressUI(latestLoaded, totalCount);
                }
            },
        };
    }

    private async initializePhysics(rapierModule: any) {
        PerformanceTracker.startPhase("Rapier Init");
        await rapierModule.init();

        this.physics.setupRapier(rapierModule);
        await this.physics.initialize();
        PerformanceTracker.endPhase("Rapier Init");
    }

    private getAllSources(): Source[] {
        return [...entrySources, ...modelSources, ...textureSources];
    }
}

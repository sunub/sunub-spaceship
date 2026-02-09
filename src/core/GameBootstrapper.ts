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
import { entrySources, modelSources, textureSources } from "@/sources"
import type { Physics } from "@/core/Physics";
import type { Audio } from "@/Environment/Audio";
import type { GameLoop } from "@/Services/GameLoop";
import type { EnvironmentManager } from "@/Manager/EnvironmentManager";
import type { WorldManager } from "@/Manager/WorldManager";


@injectable()
export class GameBootstrapper {
    constructor(
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
        @inject(GAME_CONTEXT.CORE.Lighting) private lighting: Lighting,
        @inject(GAME_CONTEXT.MANAGER.DOMManager) private domManager: DOMManager,
        @inject(GAME_CONTEXT.CORE.Game) private game: Game,
        @inject(GAME_CONTEXT.CORE.Entry) private entry: Entry,
        @inject(GAME_CONTEXT.SERVICE.ResourceService) private resourceService: Resources,
        @inject(GAME_CONTEXT.CORE.GameLoop) private gameLoop: GameLoop,
        @inject(GAME_CONTEXT.CORE.Physics) private physics: Physics,
        @inject(GAME_CONTEXT.CORE.Audio) private audio: Audio,
        @inject(GAME_CONTEXT.MANAGER.EnvironmentManager) private environmentManager: EnvironmentManager,
        @inject(GAME_CONTEXT.MANAGER.WorldManager) private worldManager: WorldManager,
    ) { }

    public async run() {
        console.log("🚀 System Booting...");

        // Phase 1: 필수 시스템 초기화 (렌더러, 카메라, 조명, 엔트리 씬)
        await this.rendering.setRenderer(this.domManager.canvas);
        await this.camera.initialize();
        this.rendering.setCamera(this.camera);
        this.lighting.initialize();

        await this.resourceService.load(entrySources);
        await this.entry.setupEntryScene();
        this.gameLoop.start();

        // Phase 2: 후처리 설정 및 나머지 에셋 로드
        this.rendering.setPostProcessing();

        await this.loadRemainingAssets((loadedCount, totalCount) => {
            this.entry.updateProgressUI(loadedCount, totalCount);
        });

        // Phase 3: 게임 오브젝트 생성 및 환경 설정
        this.environmentManager.setup();

        MeshDefaultMaterial.setup({
            lighting: this.lighting,
            terrian: this.worldManager.terrain,
            fog: this.environmentManager.fog,
        });

        await this.game.prepareGameObjects();
        this.game.setupEnvironment();

        // Phase 4: 시작 버튼 활성화 → 클릭 시 게임 시작
        // Audio 초기화(Howl 인스턴스 생성)를 전환 전에 수행하여
        // 버튼 클릭 시 오디오 디코딩 부하가 GSAP 전환과 겹치지 않도록 합니다.
        this.audio.initAudio();

        this.entry.enableStartButton(async () => {
            // 버튼 효과음은 즉시 재생 (이미 초기화 완료)
            this.audio.play("button");

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

    private async loadRemainingAssets(onProgress: (loadedCount: number, totalCount: number) => void) {
        const totalModels = modelSources.length;
        const totalTextures = textureSources.length;
        const totalCount = totalModels + totalTextures;

        let currentLoaded = 0;
        const handleProgress = () => {
            currentLoaded++;
            onProgress(currentLoaded, totalCount);
        }

        const modelResourcePromise = this.resourceService.load(
            modelSources,
            () => handleProgress(),
        )
        const textureResourcePromise = this.resourceService.load(
            textureSources,
            () => handleProgress(),
        )
        const rapierPromise = import("@dimforge/rapier3d-compat")
        const [, , rapier] = await Promise.all([
            modelResourcePromise,
            textureResourcePromise,
            rapierPromise,
        ])

        await rapier.init()

        this.physics.setupRapier(rapier)
        await this.physics.initialize()
    }
}

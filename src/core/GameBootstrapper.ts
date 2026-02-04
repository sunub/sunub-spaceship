import { inject, injectable } from "inversify";
import { GAME_CONTEXT } from "./DI/DITypes";
import type { Camera } from "@/widgets/Camera";
import type { Rendering } from "@/widgets/Rendering";
import type { Lighting } from "@/widgets/Lighting";
import type { DOMManager } from "./DOMManger";
import type { Game } from "@/widgets/Game";
import type { Entry } from "./Entry";
import type Resources from "@/utils/Resources";
import { MeshDefaultMaterial } from "@/widgets/Materials/MeshDefaultMaterial";
import { entrySources, modelSources, textureSources } from "@/sources"
import type { Physics } from "@/widgets/Physics";
import type { Audio } from "@/widgets/Audio";


@injectable()
export class GameBootstrapper {
  constructor(
    @inject(GAME_CONTEXT.Camera) private camera: Camera,
    @inject(GAME_CONTEXT.Rendering) private rendering: Rendering,
    @inject(GAME_CONTEXT.Lighting) private lighting: Lighting,
    @inject(GAME_CONTEXT.DOMManager) private domManager: DOMManager,
    @inject(GAME_CONTEXT.Game) private game: Game,
    @inject(GAME_CONTEXT.Entry) private entry: Entry,
    @inject(GAME_CONTEXT.Resources) private resources: Resources,
    @inject(GAME_CONTEXT.Physics) private physics: Physics,
    @inject(GAME_CONTEXT.Audio) private audio: Audio,
  ) { }

  public async run() {
    console.log("🚀 System Booting...");

    // Phase1 : 필수시스템 로드
    await this.rendering.setRenderer(this.domManager.canvas);
    await this.camera.initialize();
    this.rendering.setCamera(this.camera);
    this.lighting.initialize();

    await this.resources.load(entrySources);
    console.log(this.game.getContext());

    MeshDefaultMaterial.setup(this.game.getContext())
    await this.entry.setupEntryScene(this.game.getContext())

    this.game.startGameLoop()

    // Phase2 : 렌더러 및 이벤트 설정
    this.rendering.setPostProcessing()
    this.game.setupEvents()

    // Phase3 : 게임을 구성하는 환경 설정
    await this.loadRemainingAssets((loadedCount, totalCount) => {
      this.entry.updateProgressUI(loadedCount, totalCount)
    })

    await this.game.prepareGameObjects();
    await this.game.settingEnvironment()

    this.entry.enableStartButton(async () => {
      this.audio.initAudio()
      this.audio.play("button")
      this.audio.createDisplay()
      this.audio.createPanel()
      this.audio.handleSoundControl()

      this.game.startGame()
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

    const modelResourcePromise = this.resources.load(
      modelSources,
      () => handleProgress(),
    )
    const textureResourcePromise = this.resources.load(
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
    await this.physics.initialize(this.game.getContext())
  }
}
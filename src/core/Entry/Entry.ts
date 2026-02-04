import { EventEmitter } from "node:events"
import { Vector3 } from "three/webgpu"

import type { Game } from "@/widgets/Game"
import { Atmosphere } from "./model/Atmosphere"
import { AtmosphereLand } from "./model/AtmosphereLand/AtmosphereLand"
import { AtmosphereTreeLights } from "./model/AtmosphereTreeLights"
import { Background } from "./model/Background"
import { LoadingAnimation } from "./model/LoadingAnimation"
import { Planet } from "./model/Planet"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "../DI/DITypes"
import type { Lighting } from "@/widgets/Lighting"
import type { GameContext } from "../GameContext"

@injectable()
export class Entry extends EventEmitter {
    public loadingAnimation!: LoadingAnimation
    private gameLoader!: HTMLProgressElement | null;
    private loadingPercentage!: HTMLParagraphElement | null;
    private assetsRemainingLabel!: HTMLParagraphElement | null;
    private assetsLoadedCount!: HTMLParagraphElement | null;
    private loadingText!: HTMLParagraphElement | null;

    constructor(
        @inject(GAME_CONTEXT.Game) private game: Game,

        @inject(GAME_CONTEXT.Lighting) private lighting: Lighting,
    ) {
        super()
    }

    public enableStartButton(callback: () => Promise<void>) {
        const button = document.getElementById("entry-button")
        if (button) {
            button.removeAttribute("disabled")
            button.addEventListener("click", async () => {
                await callback()
                this.dispose()
            })
        }
    }


    public updateProgressUI(current: number, total: number) {
        if (!this.gameLoader) {
            this.gameLoader = document.getElementById("game-loader") as HTMLProgressElement
        }
        if (!this.loadingPercentage) {
            this.loadingPercentage = document.getElementById("loading-percentage") as HTMLParagraphElement
        }
        if (!this.assetsRemainingLabel) {
            this.assetsRemainingLabel = document.getElementById("assets-remaining-label") as HTMLParagraphElement
        }
        if (!this.assetsLoadedCount) {
            this.assetsLoadedCount = document.getElementById("assets-loaded-count") as HTMLParagraphElement
        }
        if (!this.loadingText) {
            this.loadingText = document.getElementById("loading-txt") as HTMLParagraphElement
        }

        const percent = Math.floor((current / total) * 100)
        if (this.gameLoader) {
            this.gameLoader.removeAttribute("indeterminate")
            this.gameLoader.value = percent
        }

        if (this.loadingPercentage) {
            this.loadingPercentage.innerText = `${percent}%`
        }

        if (this.assetsRemainingLabel) {
            this.assetsRemainingLabel.innerText = `Assets Remaining: ${total - current}`
        }

        if (this.assetsLoadedCount) {
            this.assetsLoadedCount.innerText = `${current}/${total}`
        }

        if (current >= total) {
            this.loadingAnimation.setLoaded()
            if (this.loadingText) {
                this.loadingText.innerText = "Ready to Launch"
            }
        }
    }

    public async setupEntryScene(context: GameContext) {
        this.lighting.initialize()
        const object_initializers_promises = this.sceneObjects.map(
            async (obj) => {
                await obj.initialize(context)
                this.game.addGameObject(obj)
            },
        )
        await Promise.all(object_initializers_promises)
    }

    get sceneObjects() {
        const objects_pos = new Vector3(0, 39.0, 0)
        const objects_scale = new Vector3(0.5, 0.5, 0.5)

        this.loadingAnimation = new LoadingAnimation(objects_pos)

        return [
            this.loadingAnimation,
            new Planet(objects_pos, objects_scale),
            new Atmosphere(objects_pos, objects_scale),
            new AtmosphereLand(objects_pos, objects_scale),
            new AtmosphereTreeLights(objects_pos, objects_scale),
            new Background(),
        ]
    }

    public removeLoadingScreen() {
        const loadingScreen = document.getElementById("loading-screen")
        if (loadingScreen) {
            loadingScreen.style.opacity = "0"
            setTimeout(() => {
                loadingScreen.remove()
            }, 500)
        }
    }

    public dispose() {
        const entrySceneDOM = document.querySelector(".entry-screen")
        if (entrySceneDOM) {
            entrySceneDOM.innerHTML = ""
            entrySceneDOM.remove()
        }

        const loadingZone = document.querySelector("#loading-zone")
        if (loadingZone) {
            loadingZone.remove()
        }

        this.removeAllListeners()
    }
}

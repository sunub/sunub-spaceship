import { EventEmitter } from "node:events"
import { Vector3 } from "three/webgpu"

import { Atmosphere } from "./model/Atmosphere"
import { AtmosphereLand } from "./model/AtmosphereLand/AtmosphereLand"
import { AtmosphereTreeLights } from "./model/AtmosphereTreeLights"
import { Background } from "./model/Background"
import { LoadingAnimation } from "./model/LoadingAnimation"
import { Planet } from "./model/Planet"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "../DI/DITypes"
import type { Lighting } from "@/core/Lighting"
import type { ISceneManager } from "@/Services/ISceneManager"
import type { IResourceService } from "@/Services/IResouceService"
import type { ResourceModel } from "@/Models"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"

@injectable()
export class Entry extends EventEmitter {
    public loadingAnimation!: LoadingAnimation
    private gameLoader!: HTMLProgressElement | null;
    private loadingPercentage!: HTMLParagraphElement | null;
    private assetsRemainingLabel!: HTMLParagraphElement | null;
    private assetsLoadedCount!: HTMLParagraphElement | null;
    private loadingText!: HTMLParagraphElement | null;
    private _sceneObjects: Array<ResourceModel> = []

    constructor(
        @inject(GAME_CONTEXT.CORE.Lighting) private lighting: Lighting,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) private sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.ResourceService) private resourceService: IResourceService,
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {
        super()
    }

    public enableStartButton(callback: () => Promise<void>) {
        const button = document.getElementById("entry-button")
        if (button) {
            button.removeAttribute("disabled")
            button.addEventListener("click", async () => {
                this.dispose()
                await callback()
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

    public async setupEntryScene() {
        const objects_pos = new Vector3(0, 39.0, 0)
        this.lighting.initialize()
        this.initializeSceneObjects()
        this.loadingAnimation = new LoadingAnimation(objects_pos)
        await this.loadingAnimation.initialize()
        this.sceneManager.add(this.loadingAnimation.pivotGroup)
        this.sceneManager.add(this.loadingAnimation.instancedMesh)

        const object_initializers_promises = this._sceneObjects.map(
            async (obj) => {
                await obj.initialize()
            },
        )
        await Promise.all(object_initializers_promises)
    }

    private initializeSceneObjects() {
        const objects_pos = new Vector3(0, 39.0, 0)
        const objects_scale = new Vector3(0.5, 0.5, 0.5)

        this._sceneObjects = [
            new Planet(this.resourceService, this.sceneManager, objects_pos, objects_scale),
            new Atmosphere(this.resourceService, this.sceneManager, objects_pos, objects_scale),
            new AtmosphereLand(this.resourceService, this.sceneManager, objects_pos, objects_scale),
            new AtmosphereTreeLights(this.resourceService, this.sceneManager, objects_pos, objects_scale),
            new Background(this.resourceService, this.sceneManager),
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

    /**
     * DOM을 페이드 아웃 후 제거하여 reflow 스파이크를 방지합니다.
     * GameLoop에 Entry dispose를 알려 LoadingAnimation GPU 업로드를 스킵합니다.
     */
    public dispose() {
        // EventBus를 통해 GameLoop에 Entry dispose 알림 (순환 의존 방지)
        this.eventBus.emit(GameEvents.ENTRY_DISPOSED, undefined)

        const entrySceneDOM = document.querySelector(".entry-screen") as HTMLElement | null
        if (entrySceneDOM) {
            // CSS transition으로 페이드 아웃 후 DOM 제거 (대규모 reflow 분산)
            entrySceneDOM.style.transition = "opacity 0.3s ease-out"
            entrySceneDOM.style.opacity = "0"
            entrySceneDOM.style.pointerEvents = "none"
            entrySceneDOM.addEventListener("transitionend", () => {
                entrySceneDOM.remove()
            }, { once: true })
        }

        const loadingZone = document.querySelector("#loading-zone") as HTMLElement | null
        if (loadingZone) {
            loadingZone.style.transition = "opacity 0.3s ease-out"
            loadingZone.style.opacity = "0"
            loadingZone.style.pointerEvents = "none"
            loadingZone.addEventListener("transitionend", () => {
                loadingZone.remove()
            }, { once: true })
        }

        this.removeAllListeners()
    }

    public update(delta: number) {
        this._sceneObjects.forEach((obj) => {
            obj.update(delta)
        })
        this.loadingAnimation.update(delta)
    }
}

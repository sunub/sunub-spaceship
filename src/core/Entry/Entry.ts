import { EventEmitter } from "node:events"
import { Vector3 } from "three/webgpu"
import type Resources from "@/utils/Resources"
import type { Audio } from "@/widgets/Audio"
import type { Game } from "@/widgets/Game"
import { entrySources, modelSources, textureSources } from "../../sources"
import type { GameContext } from "../GameContext"
import { Atmosphere } from "./model/Atmosphere"
import { AtmosphereLand } from "./model/AtmosphereLand/AtmosphereLand"
import { AtmosphereTreeLights } from "./model/AtmosphereTreeLights"
import { Background } from "./model/Background"
import { LoadingAnimation } from "./model/LoadingAnimation"
import { Planet } from "./model/Planet"

export class Entry extends EventEmitter {
    private resources: Resources
    private game: Game
    private loadingAnimation!: LoadingAnimation
    private audio: Audio

    constructor(private context: GameContext) {
        super()
        this.resources = this.context.resources
        this.game = this.context.game
        this.audio = this.context.audio
    }

    async init() {
        await this.resources.load(entrySources)

        await this.settingEntryScene()
        this.loadRemainingAssets()
        this.spawn()
    }

    private async loadRemainingAssets() {
        let loadedCount = 0
        const totalCount = modelSources.length + textureSources.length

        const gameLoader = document.getElementById(
            "game-loader",
        ) as HTMLProgressElement
        const loadingPercentage = document.getElementById("loading-percentage")
        const assetsRemainingLabel = document.getElementById(
            "assets-remaining-label",
        )
        const assetsLoadedCount = document.getElementById("assets-loaded-count")
        const loadingText = document.getElementById("loading-txt")

        // Initialize display
        if (assetsLoadedCount) assetsLoadedCount.innerText = `0/${totalCount}`
        if (assetsRemainingLabel)
            assetsRemainingLabel.innerText = `Assets Remaining: ${totalCount}`

        const onProgress = () => {
            loadedCount++
            const percent = Math.floor((loadedCount / totalCount) * 100)

            if (gameLoader) {
                gameLoader.removeAttribute("indeterminate")
                gameLoader.value = percent
            }

            if (loadingPercentage) {
                loadingPercentage.innerText = `${percent}%`
            }

            if (assetsRemainingLabel) {
                assetsRemainingLabel.innerText = `Assets Remaining: ${totalCount - loadedCount}`
            }

            if (assetsLoadedCount) {
                assetsLoadedCount.innerText = `${loadedCount}/${totalCount}`
            }

            if (loadedCount >= totalCount) {
                this.loadingAnimation.setLoaded()
                if (loadingText) loadingText.innerText = "Ready to Launch"
            }
        }

        const modelResourcePromise = this.resources.load(
            modelSources,
            onProgress,
        )
        const textureResourcePromise = this.resources.load(
            textureSources,
            onProgress,
        )
        const rapierPromise = import("@dimforge/rapier3d-compat")
        const [, , rapier] = await Promise.all([
            modelResourcePromise,
            textureResourcePromise,
            rapierPromise,
        ])

        this.context.rapier = rapier
        await this.context.rapier.init()
        await this.game.physics.initialize(this.context)

        await this.game.prepareGameObjects()

        this.emit("resourcesLoaded")
    }

    private spawn() {
        this.on("resourcesLoaded", async () => {
            await this.game.settingEnvironment()
            this.activateEnterButton()
        })
    }

    public activateEnterButton() {
        const button = document.getElementById("entry-button")
        if (button) {
            button.removeAttribute("disabled")
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

    private async settingEntryScene() {
        await this.context.camera.initialize(this.context)

        this.context.lighting.initialize()
        const object_initializers_promises = this.sceneObjects.map(
            async (obj) => {
                await obj.initialize(this.context)
                this.game.addGameObject(obj)
            },
        )
        await Promise.all(object_initializers_promises)

        this.context.rendering.setPostProcessing()
        this.game.setupEvents()

        this.createLoadingLoader()
    }

    public createLoadingLoader() {
        const button = document.querySelector("#entry-button")
        if (button) {
            button.addEventListener("click", () => {
                this.audio.initAudio()
                this.audio.play("button")
                this.audio.createDisplay()
                this.audio.createPanel()
                this.audio.handleSoundControl()

                this.game.startGame()
                this.dispose()
            })
        }
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
            new Background(this.context),
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
}

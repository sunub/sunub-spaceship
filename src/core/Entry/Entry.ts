import { EventEmitter } from "node:events"
import { Vector3 } from "three/webgpu"
import type Resources from "@/utils/Resources"
import { Game } from "@/widgets/Game"
import { entrySources, modelSources, textureSources } from "../../sources"
import type { GameContext } from "../GameContext"
import { Atmosphere } from "./model/Atmosphere"
import { AtmosphereCrystal } from "./model/AtmosphereCrystal"
import { AtmosphereLand } from "./model/AtmosphereLand/AtmosphereLand"
import { AtmosphereTreeLights } from "./model/AtmosphereTreeLights"
import { Background } from "./model/Background"
import { LoadingAnimation } from "./model/LoadingAnimation"
import { Planet } from "./model/Planet"

export class Entry extends EventEmitter {
    private resources: Resources
    private game: Game

    constructor(private context: GameContext) {
        super()
        this.resources = this.context.resources
        this.game = Game.getInstance()
    }

    async init() {
        await this.resources.load(entrySources)

        await this.settingEntryScene()
        this.loadRemainingAssets()
        this.spawn()
        this.createEnterButton()
    }

    public async loadRemainingAssets() {
        let loadedCount = 0
        const totalCount = modelSources.length + textureSources.length
        const gameLoader = document.getElementById(
            "game-loader",
        ) as HTMLProgressElement

        const onProgress = () => {
            loadedCount++
            if (gameLoader) {
                gameLoader.removeAttribute("indeterminate")
                gameLoader.value = loadedCount / totalCount
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
        console.log("resourcesLoaded")
    }

    public spawn() {
        this.on("resourcesLoaded", async () => {
            await this.game.settingEnvironment()
            this.emit("spawn")
        })
    }

    public createEnterButton() {
        this.on("spawn", () => {
            const html = `
        <button id="entry-button">Enter</button>
      `

            const entrySceneDOM = document.querySelector(".entry-screen")
            if (entrySceneDOM) {
                entrySceneDOM.insertAdjacentHTML("beforeend", html)
            }

            const button = document.querySelector("#entry-button")
            if (button) {
                button.addEventListener("click", () => {
                    this.game.startGame()
                    this.dispose()
                })
            }
        })
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
        console.log(this.context.camera.instance)
        this.context.camera.transitionTo(
            "entry",
            new Vector3(0, 0, 10),
            new Vector3(0, 39, 0),
            0,
        )

        for (const obj of this.sceneObjects) {
            await obj.initialize(this.context)
            this.game.addGameObject(obj)
        }

        this.context.rendering.setPostProcessing()
        this.game.setupEvents()

        this.createLoadingLoader()
    }

    public createLoadingLoader() {
        const html = `
      <main id="loading-zone" aria-busy="true">
        <p>Loading Level</p>
        <div class="loading-container">
          <span id="loading-label" class="sr-only">Loading progress</span>

          <progress
            id="game-loader"
            indeterminate
            aria-labelledby="loading-label"
            aria-describedby="loading-zone"
            tabindex="-1"
          >
            unknown
          </progress>
        </div>
      </main>
    `

        const entrySceneDOM = document.querySelector(".entry-screen")
        if (entrySceneDOM) {
            entrySceneDOM.insertAdjacentHTML("beforeend", html)
        }
    }

    get sceneObjects() {
        const objects_pos = new Vector3(0, 40, 0)
        const objects_scale = new Vector3(0.5, 0.5, 0.5)

        return [
            new Planet(objects_pos, objects_scale),
            new Atmosphere(objects_pos, objects_scale),
            new AtmosphereLand(objects_pos, objects_scale),
            new AtmosphereCrystal(objects_pos, objects_scale),
            new AtmosphereTreeLights(objects_pos, objects_scale),
            new LoadingAnimation(objects_pos),
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

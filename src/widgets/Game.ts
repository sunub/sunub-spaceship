import type * as RAPIER from "@dimforge/rapier3d-compat"
import { Vector3 } from "three/webgpu"
import { Entry } from "@/core/Entry"
import type { GameContext, IController, IGameObject } from "../core/GameContext"
import { ProjectRegistry } from "../core/ProjectRegistry"
import { InputManager } from "../Inputs/InputManager"
import Resources from "../utils/Resources"
import { Size } from "../utils/Size"
import Time from "../utils/Time"
import { Audio } from "./Audio"
import { Camera } from "./Camera"
import { CSSRenderer } from "./CSSRenderer"
import type { Debug } from "./Debug"
import { FixedNightFog } from "./Fog"
import { Lighting } from "./Lighting"
import {
    Birds,
    BrightCrystal,
    CrystalStructure,
    FloatCrystal,
    Floor,
    Github,
    Grass,
    Mountain,
    MountainOutliner,
    SpaceShip,
    TreeLights,
} from "./Models"
import { ProjectOutpost } from "./Models/ProjectOutpost"
import { Physics } from "./Physics"
import { Rendering } from "./Rendering"
import { Scene } from "./Scene"
import { Notification } from "./UI/Notification"
import { TerminalOverlay } from "./UI/TerminalOverlay"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"


@injectable()
export class Game {
    public isReady: boolean = false
    public isPausedByVisibility: boolean = false
    private shouldResetTime: boolean = false

    // Game 내부에서 접근이 필요한 주요 시스템들
    public debug!: Debug
    public terrain!: Floor
    public fog!: FixedNightFog
    public entry!: Entry
    public rapier!: typeof RAPIER
    public notification!: Notification

    // Game Objects & Controllers 관리
    private gameObjects: IGameObject[] = []
    private controllers: IController[] = []
    private projectOutposts: ProjectOutpost[] = []
    
    // SpaceShip은 이제 주입받으므로 초기화가 보장됨 (하지만 initialize 호출은 필요함)
    public spaceShip!: SpaceShip
    private isRendering = false

    private terminalOverlay!: TerminalOverlay
    private lastInteractionTime: number = 0
    private readonly INTERACTION_COOLDOWN: number = 500
    
    private _contextCache: GameContext | null = null;

    constructor(
        @inject(GAME_CONTEXT.Time) private time: Time,
        @inject(GAME_CONTEXT.Size) private size: Size,
        @inject(GAME_CONTEXT.InputManager) private inputManager: InputManager,
        @inject(GAME_CONTEXT.Resources) private resources: Resources,
        @inject(GAME_CONTEXT.Lighting) private lighting: Lighting,
        @inject(GAME_CONTEXT.Scene) private scene: Scene,
        @inject(GAME_CONTEXT.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.Physics) private physics: Physics,
        @inject(GAME_CONTEXT.Rendering) private rendering: Rendering,
        @inject(GAME_CONTEXT.CSSRenderer) private cssRenderer: CSSRenderer,
        @inject(GAME_CONTEXT.Audio) private audio: Audio,
        @inject(GAME_CONTEXT.SpaceShipFactory) private spaceShipFactory: () => SpaceShip
    ) {}

    get sceneObjects() {
        return [
            new Floor(),
            new Mountain(),
            new MountainOutliner(),
            new Grass({
                count: 25000,
                width: 0.25,
                height: 1.0,
            }),
            new TreeLights(),
            new FloatCrystal(),
            new BrightCrystal(),
            new CrystalStructure(),
            new Birds(),
            new Github(),
        ]
    }

    public async prepareGameObjects() {
        const context = this.getContext()
        const sceneObjectsPromises = this.sceneObjects.map(async (obj) => {
            await obj.initialize(context)
            this.addGameObject(obj)
            if (obj instanceof Floor) {
                this.terrain = obj
            }
        })
        await Promise.all(sceneObjectsPromises)

        const spaceShip = this.spaceShipFactory()
        await spaceShip.initialize(context)
        this.addGameObject(spaceShip)
        this.spaceShip = spaceShip

        const projectRegistry = ProjectRegistry.getInstance()
        const projects = projectRegistry.getProjects()
        const projectObjectsPromises = projects.map(async (projectData) => {
            const outpost = new ProjectOutpost(projectData)
            await outpost.initialize(context)
            outpost.setOnInteraction(() => {
                this.handleInteraction()
            })
            if (this.spaceShip?.rigidBody) {
                outpost.setTrackingTarget(this.spaceShip.rigidBody)
            }
            this.addGameObject(outpost)
            this.projectOutposts.push(outpost)
        })
        await Promise.all(projectObjectsPromises)
    }

    public async settingEnvironment() {
        this.rendering.setPostProcessing()
        this.setupEnvironment()
        this.setupEvents()
    }

    public async startGame() {
        this.isReady = true
        this.time.reset(performance.now())
        this.audio.play("background")
        this.drawControlIndicators()
        this.setupVisibilityEvents()
        if (this.camera && this.spaceShip && this.spaceShip.shipPivot) {
            const targetPos = this.spaceShip.shipPivot.getWorldPosition(
                new Vector3(),
            )
            const flightOffset = this.spaceShip.flightCameraOffset

            if (this.camera.orbitControls) {
                this.camera.orbitControls.enabled = false
            }

            this.camera.setFollowTargetObject(
                this.spaceShip.shipPivot,
                flightOffset,
                0.12,
            )

            await this.camera.transitionTo(
                "follow",
                flightOffset,
                targetPos,
                2.0,
            )
        }
        this.notification.show(
            "조작키를 사용하여 우주선을 조작해 프로젝트 영역을 찾아주세요",
            3000,
        )
        this.spaceShip.unlock()
    }

    public drawControlIndicators() {
        const html = `
        <div class="control-group">
            <div id="key-w" class="control-key dark">W</div>
            <div class="key-row">
                <div id="key-a" class="control-key">A</div>
                <div id="key-s" class="control-key">S</div>
                <div id="key-d" class="control-key">D</div>
            </div>
        </div>
        `

        document.body.insertAdjacentHTML("beforeend", html)
    }

    public getContext() {
        if (this._contextCache) {
            return this._contextCache;
        }

        this._contextCache = {
            rendering: this.rendering,
            scene: this.scene,
            camera: this.camera,
            physics: this.physics,
            time: this.time,
            size: this.size,
            debug: this.debug,
            inputManager: this.inputManager,
            resources: this.resources,
            cssRenderer: this.cssRenderer,
            lighting: this.lighting,
            rapier: this.rapier,
            audio: this.audio,
            game: this,
        }
        return this._contextCache;
    }

    public addGameObject(obj: IGameObject): void {
        this.gameObjects.push(obj)
    }

    public addController(controller: IController): void {
        this.controllers.push(controller)
    }

    public removeController(controller: IController): void {
        const index = this.controllers.indexOf(controller)
        if (index > -1) {
        this.controllers.splice(index, 1)
        }
    }

    public startGameLoop() {
        this.rendering.renderer.setAnimationLoop(this.gameLoop.bind(this))
    }

    private gameLoop(time: number) {
        if (this.shouldResetTime) {
            this.time.reset(time)
            this.shouldResetTime = false
        }
        this.time.update(time)
        this.update()
    }

    private setupEnvironment() {
        this.fog = new FixedNightFog(this.getContext())
        this.notification = new Notification()
        this.terminalOverlay = new TerminalOverlay(this.getContext())
    }

    public setupEvents() {
        this.time.on("tick", () => this.update())
        this.size.on("resize", () => this.resize())

        this.inputManager.subscribe("Interact", (isPressed) => {
            if (isPressed) {
                this.handleInteraction()
            }
        })
    }

    public setupVisibilityEvents() {
        document.addEventListener(
            "visibilitychange",
            this.handleVisibilityChange.bind(this),
        )
    }

    private handleVisibilityChange() {
        console.log("Visibility changed:", document.visibilityState)
        if (document.visibilityState === "hidden") {
            this.audio.systemMute(true)
            this.isPausedByVisibility = true
        } else {
            if (this.isPausedByVisibility) {
                this.shouldResetTime = true
                this.audio.systemMute(false)
                this.isPausedByVisibility = false
            }
        }
    }

    private handleInteraction() {
        const now = Date.now()
        if (now - this.lastInteractionTime < this.INTERACTION_COOLDOWN) {
            return
        }
        this.lastInteractionTime = now
        if (this.terminalOverlay.isOpen) {
            this.terminalOverlay.hide()
            this.spaceShip.joyStick.unlock()
            return
        }

        const activeOutpost = this.projectOutposts.find((p) => p.isInside)
        if (activeOutpost) {
            this.terminalOverlay.show(activeOutpost.data)
            this.spaceShip.joyStick.lock()
        }
    }

    private async update() {
        if (this.isRendering) {
            return
        }

        this.isRendering = true
        // Delta limiting to prevent death spiral on low FPS (Max 20FPS)
        // Convert ms to seconds
        const deltaTime = Math.min(this.time.delta * 0.001, 0.05)

        try {
            this.lighting.update()

            // Physics Update (Variable Timestep)
            // Sync physics step with render frame time 1:1
            this.gameObjects.forEach((obj) => {
                obj.updatePhysics?.(deltaTime)
            })
            // Pass delta time in seconds (already converted above)
            this.physics.step(deltaTime)

            this.gameObjects.forEach((obj) => {
                obj.update(deltaTime)
            })
            this.controllers.forEach((controller) => {
                if (controller.enabled) {
                    controller.update()
                }
            })
            this.physics.update()
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

    private resize() {
        this.rendering.resize()
        this.controllers.forEach((controller) => {
            controller.update?.()
        })
    }
}

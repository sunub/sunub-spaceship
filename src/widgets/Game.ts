import type * as RAPIER from "@dimforge/rapier3d-compat"
import { Vector3 } from "three/webgpu"
import { Entry } from "@/core/Entry"
import type { GameContext, IController, IGameObject } from "../core/GameContext"
import { ProjectRegistry } from "../core/ProjectRegistry"
import { ServiceRegistry } from "../core/ServiceRegistry"
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

export class Game {
    public isReady: boolean = false

    private static instance: Game
    private domElement!: HTMLDivElement
    private canvasElement!: HTMLCanvasElement
    private serviceRegistry = ServiceRegistry.getInstance()

    // Game 내부에서 접근이 필요한 주요 시스템들
    public rendering!: Rendering
    public scene!: Scene
    public camera!: Camera
    public physics!: Physics
    public time!: Time
    public size!: Size
    public debug!: Debug
    public inputManager!: InputManager
    public resources!: Resources
    public cssRenderer!: CSSRenderer
    public lighting!: Lighting
    public terrain!: Floor
    public fog!: FixedNightFog
    public entry!: Entry
    public rapier!: typeof RAPIER
    public audio!: Audio
    public notification!: Notification

    // Game Objects & Controllers 관리
    private gameObjects: IGameObject[] = []
    private controllers: IController[] = []
    private projectOutposts: ProjectOutpost[] = []
    public spaceShip!: SpaceShip
    private isRendering = false

    private terminalOverlay!: TerminalOverlay
    private lastInteractionTime: number = 0
    private readonly INTERACTION_COOLDOWN: number = 500

    static getInstance(): Game {
        if (!Game.instance) {
            Game.instance = new Game()
        }
        return Game.instance
    }

    private constructor() {}

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

    public async init() {
        this.domElement = document.querySelector(".root") as HTMLDivElement
        this.canvasElement = this.domElement.querySelector(
            ".canvas",
        ) as HTMLCanvasElement

        this.time = new Time()
        this.size = new Size()
        this.scene = new Scene()
        this.camera = new Camera()
        this.physics = new Physics()
        this.inputManager = InputManager.getInstance()
        this.resources = new Resources()
        this.audio = new Audio()
        this.registerAllServices()

        this.rendering = new Rendering()
        await this.rendering.setRenderer()
        this.cssRenderer = new CSSRenderer()
        this.lighting = new Lighting(this)

        const gameContext = this.getContext()
        this.entry = new Entry(gameContext)
        this.terminalOverlay = new TerminalOverlay(gameContext)
        this.notification = new Notification()
        await this.entry.init()
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

        const spaceShip = new SpaceShip()
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
        this.audio.play("background")
        this.drawControlIndicators()
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

    private registerAllServices() {
        this.serviceRegistry.register("game", this)
        this.serviceRegistry.register("domElement", this.domElement)
        this.serviceRegistry.register("canvas", this.canvasElement)
        this.serviceRegistry.register("debug", this.debug)
        this.serviceRegistry.register("time", this.time)
        this.serviceRegistry.register("size", this.size)
        this.serviceRegistry.register("scene", this.scene)
        this.serviceRegistry.register("camera", this.camera)
        this.serviceRegistry.register("physics", this.physics)
        this.serviceRegistry.register("inputManager", this.inputManager)
        this.serviceRegistry.register("cssRenderer", this.cssRenderer)
        this.serviceRegistry.register("resources", this.resources)
        this.serviceRegistry.register("lighting", this.lighting)
        this.serviceRegistry.register("rapier", this.rapier)
        this.serviceRegistry.register("audio", this.audio)
    }

    public getContext(): GameContext {
        return {
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
            domElement: this.domElement,
            canvas: this.canvasElement,
            lighting: this.lighting,
            rapier: this.rapier,
            audio: this.audio,
            game: this,
        }
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

    public start() {
        this.rendering.renderer.setAnimationLoop(this.gameLoop.bind(this))
    }

    private gameLoop(time: number) {
        this.time.update(time)
        this.update()
    }

    private setupEnvironment() {
        this.fog = new FixedNightFog()
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
        const deltaTime = this.time.delta

        try {
            this.physics.step()

            this.lighting.update()
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

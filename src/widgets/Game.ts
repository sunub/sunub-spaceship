import * as RAPIER from "@dimforge/rapier3d-compat"
import type { OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three/webgpu"
import type { GameContext, IController, IGameObject } from "../core/GameContext"
import { ProjectRegistry } from "../core/ProjectRegistry"
import { ServiceRegistry } from "../core/ServiceRegistry"
import { InputManager } from "../Inputs/InputManager"
import { FlightActionMapper } from "../Inputs/mappers/FlightActionMapper"
import { Vector2Processor } from "../Inputs/processors/Vector2Processor"
import type { InputEventData } from "../Inputs/types"
import sources from "../sources"
import Resources from "../utils/Resources"
import { Size } from "../utils/Size"
import Time from "../utils/Time"
import { Camera } from "./Camera"
import { CSSRenderer } from "./CSSRenderer"
import { Debug } from "./Debug"
import { Floor } from "./Floor"
import { Lighting } from "./Lighting"
// import { Atmosphere, Planet, Rocks, TreeLights, SpaceShip } from "./models";
import { SpaceShip } from "./Models"
import * as Basic from "./Models/Basic"
import { ProjectOutpost } from "./Models/ProjectOutpost"
import { Physics } from "./Physics"
import { Renderer } from "./Renderer"
import { Scene } from "./Scene"
import { TerminalOverlay } from "./UI/TerminalOverlay"

export class Game {
	private static instance: Game

	// Core Services (읽기 전용으로 공개)
	public readonly renderer: Renderer
	public readonly scene: Scene
	public readonly camera: Camera
	public readonly physics: Physics
	public readonly time: Time
	public readonly size: Size
	public readonly debug: Debug
	public readonly inputManager: InputManager
	public readonly resources: Resources
	public readonly cssRenderer: CSSRenderer
	public readonly lighting: Lighting

	// Game Objects & Controllers 관리
	private gameObjects: IGameObject[] = []
	private controllers: IController[] = []
	private projectOutposts: ProjectOutpost[] = []
	private terminalOverlay: TerminalOverlay
	private isInitialized = false
	private isRendering = false

	private constructor() {
		// GameObject를 초기화 할 경우 내부에서 동작하는 객체들에 대한 의존성의 순서를 고려하는 것이 중요하다.
		this.debug = new Debug({ title: "Game Controller" })
		this.time = new Time()
		this.size = new Size()
		this.scene = new Scene()
		this.camera = new Camera()
		this.physics = new Physics()
		this.inputManager = InputManager.getInstance()
		this.resources = new Resources(sources)
		// Game 인스턴스에 직접 접근하지 않고 ServiceRegistry를 통해 접근할 수 있도록 GameContext를 제공한다.
		this.registerAllServices()

		this.cssRenderer = new CSSRenderer()
		this.terminalOverlay = new TerminalOverlay()

		// CSSRenderer가 생성된 후 다시 등록하여 완전한 상태를 유지한다.
		ServiceRegistry.getInstance().register("cssRenderer", this.cssRenderer)

		// Renderer 는 여러 객체에 의존성이 있으므로 가장 마지막에 초기화하는 것이 안전하다.
		this.renderer = new Renderer()
		this.registerRenderer()

		// Lighting 초기화 (Game 인스턴스 주입)
		this.lighting = new Lighting(this)
	}

	static getInstance(): Game {
		if (!Game.instance) {
			Game.instance = new Game()
		}
		return Game.instance
	}

	get orbitControls(): OrbitControls | undefined {
		return this.camera.orbitControls
	}

	private registerAllServices() {
		const registry = ServiceRegistry.getInstance()
		registry.register("game", this)
		registry.register("debug", this.debug)
		registry.register("time", this.time)
		registry.register("size", this.size)
		registry.register("scene", this.scene)
		registry.register("camera", this.camera)
		registry.register("physics", this.physics)
		registry.register("inputManager", this.inputManager)
		registry.register("resources", this.resources)
		registry.register("cssRenderer", this.cssRenderer)
		registry.register("lighting", this.lighting) // TBD: Register if needed, though property access exists
	}

	private registerRenderer() {
		const registry = ServiceRegistry.getInstance()
		registry.register("renderer", this.renderer)
	}

	addGameObject(obj: IGameObject): void {
		this.gameObjects.push(obj)
		if (this.isInitialized) {
			obj.initialize?.(this.getContext())
		}
	}

	addController(controller: IController): void {
		this.controllers.push(controller)
	}

	removeController(controller: IController): void {
		const index = this.controllers.indexOf(controller)
		if (index > -1) {
			this.controllers.splice(index, 1)
		}
	}

	getContext(): GameContext {
		return {
			renderer: this.renderer,
			scene: this.scene,
			camera: this.camera,
			physics: this.physics,
			time: this.time,
			size: this.size,
			debug: this.debug,
			inputManager: this.inputManager,
			resources: this.resources,
		}
	}

	getService<T>(key: string): T {
		return ServiceRegistry.getInstance().get<T>(key)
	}

	get sceneObjects() {
		return [
			new Floor(200),
			// new Planet(new THREE.Vector3(0, 10, 0)),
			// new Atmosphere(new THREE.Vector3(0, 10, 0)),
			// new Rocks(new THREE.Vector3(0, 10, 0)),
			// new TreeLights(new THREE.Vector3(0, 10, 0)),
			// new Birds()
		]
	}

	async initialize() {
		if (this.isInitialized) {
			return
		}

		await RAPIER.init()
		await this.physics.initialize()

		// 리소스 로딩 완료까지 대기
		await this.resources.waitForReady()

		await this.renderer.initialize()

		// Lighting 초기화
		this.lighting.initialize()

		// 1. 핵심 객체들 먼저 초기화
		const context = this.getContext()

		for (const obj of this.sceneObjects) {
			await obj.initialize(context)
			this.addGameObject(obj)
		}

		const spaceShip = new SpaceShip()
		await spaceShip.initialize(context)
		this.addGameObject(spaceShip)

		const ballColors = [
			"#E7E7E7",
			"#FF7400",
			"#FF0009",
			"#5A666B",
			"#FFE575",
			"#615C49",
			"#A7A083",
			"#FF1A17",
		]

		const ballData = ballColors.map((color, index) => ({
			position: new THREE.Vector3((index - 3.5) * 2.5, 1, -5), // Offset Z to not overlap with boxes, spread on X
			color: color,
		}))

		const boxData = ballColors.map((color, index) => ({
			position: new THREE.Vector3((index - 3.5) * 2.5, 1, -2.5), // Offset Z to not overlap with boxes, spread on X
			color: color,
		}))

		ballData.forEach(({ position, color }) => {
			const ball = Basic.Balls.initialize(position, color)
			this.scene.add(ball)
		})

		boxData.forEach(({ position, color }) => {
			const box = Basic.Box.initialize(position, color)
			this.scene.add(box)
		})

		// 2. 포트폴리오 프로젝트들 생성 및 초기화
		const projectRegistry = ProjectRegistry.getInstance()
		const projects = projectRegistry.getProjects()

		for (const projectData of projects) {
			const outpost = new ProjectOutpost(projectData)

			// 우주선이 초기화된 후이므로 rigidBody가 존재함
			outpost.setTrackingTarget(spaceShip.rigidBody)

			await outpost.initialize(context)
			this.addGameObject(outpost)
			this.projectOutposts.push(outpost)
		}

		await this.camera.initialize(context)
		this.renderer.setPostProcessing(context)

		// Loop removed to prevent double initialization.
		// Objects added via addGameObject during initialize() are explicitly initialized above.

		this.setupInputSystem()
		this.setupEnvironment()
		this.setupEvents()

		this.isInitialized = true
	}

	start() {
		if (!this.isInitialized) {
			throw new Error("Game must be initialized before starting")
		}
		this.time.startGameLoop()
	}

	private setupEnvironment() {
		// Lighting handles directional light and ambient light (if configured there, otherwise keep ambient here or move to Lighting)
		// Removed manual DirectionalLight setup as Lighting class handles it.
		// const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
		// this.scene.add(ambientLight)
	}

	private setupInputSystem() {
		const movementProcessor = new Vector2Processor("movement", {
			upKey: "KeyW",
			downKey: "KeyS",
			leftKey: "KeyA",
			rightKey: "KeyD",
		})
		this.inputManager.addProcessor(movementProcessor)

		// 플레이어 비행 액션 매퍼 등록
		// 현재 등록되어 있는 FlightActionMapper 에는 KeyWASD 기반 움직임이 포함되어 있음
		// 필요시 별도의 매퍼를 만들어 등록 가능
		const flightMapper = new FlightActionMapper()
		this.inputManager.addActionMapper(flightMapper)
	}

	private setupEvents() {
		this.time.on("tick", () => this.update())
		this.size.on("resize", () => this.resize())

		// 키보드 인터랙션 이벤트 (E 키)
		this.inputManager.on("input.keydown", (data: InputEventData) => {
			if (data?.key?.code === "KeyE") {
				this.handleInteraction()
			}
		})
	}

	private handleInteraction() {
		// 이미 터미널이 열려있으면 닫기 (또는 무시)
		if (this.terminalOverlay.isOpen) {
			this.terminalOverlay.hide()
			return
		}

		// 현재 우주선이 트리거 내부에 있는 프로젝트 찾기
		const activeOutpost = this.projectOutposts.find((p) => p.isInside)
		if (activeOutpost) {
			this.terminalOverlay.show(activeOutpost.data)
		}
	}

	private async update() {
		if (this.isRendering) {
			return
		}

		this.isRendering = true
		const deltaTime = this.time.delta
		this.inputManager.update()
		this.physics.step()

		// Update Lighting
		this.lighting.update()

		// 등록되어 있는 모든 게임 오브젝트와 컨트롤러 업데이트(ex, 우주선, 카메라 등)
		this.gameObjects.forEach((obj) => {
			obj.update(deltaTime)
		})
		this.controllers.forEach((controller) => {
			if (controller.enabled) {
				controller.update()
			}
		})
		this.camera.orbitControls?.update(deltaTime)
		this.physics.update()

		await this.renderer.update()
		if (this.cssRenderer && this.scene && this.camera.instance) {
			await this.cssRenderer.render(this.scene, this.camera.instance)
		}
		this.isRendering = false
	}

	private resize() {
		this.controllers.forEach((controller) => {
			controller.update?.()
		})
	}
}

import { bloom } from "three/addons/tsl/display/BloomNode.js"
import { pass, renderOutput } from "three/tsl"
import { PostProcessing, WebGPURenderer } from "three/webgpu"
import type { GameContext } from "@/core/GameContext"
import { ServiceRegistry } from "../core/ServiceRegistry"
import type { Size } from "../utils/Size"
import type { Camera } from "./Camera"
import { cheapDOF } from "./Passes/CheapDOF"
import type { Scene } from "./Scene"

export class Renderer extends WebGPURenderer {
	private root: HTMLElement
	private _size: Size
	private _scene: Scene
	private _camera: Camera
	private isInitialized = false
	private postProcessing!: PostProcessing
	private bloomPass!: ReturnType<typeof bloom>
	private cheapDOFPass!: ReturnType<typeof cheapDOF>

	constructor() {
		super()

		const registry = ServiceRegistry.getInstance()
		this._size = registry.get<Size>("size")
		this._scene = registry.get<Scene>("scene")
		this._camera = registry.get<Camera>("camera")

		this.setSize(this._size.width, this._size.height)

		const root = document.getElementById("root")
		if (!root) {
			throw new Error("Root element with id 'root' not found")
		}

		this.root = root
		this.root.appendChild(this.domElement)

		this.shadowMap.enabled = true

		this.setupEvents()
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}
		await this.init()
		this.isInitialized = true
	}

	public setPostProcessing(context: GameContext) {
		const { scene, camera } = context
		this.postProcessing = new PostProcessing(this)

		const scenePass = pass(scene, camera.instance)
		const scenePassColor = scenePass.getTextureNode("output")

		this.bloomPass = bloom(scenePassColor)
		this.bloomPass.threshold.value = 1
		this.bloomPass.strength.value = 0.25
		this.bloomPass.smoothWidth.value = 1

		this.cheapDOFPass = cheapDOF(renderOutput(scenePass))
		this.postProcessing.outputNode = this.cheapDOFPass.add(this.bloomPass)
	}

	get size(): Size {
		return this._size
	}
	get scene(): Scene {
		return this._scene
	}
	get camera(): Camera {
		return this._camera
	}

	private setupEvents() {
		this._size.on("resize", () => this.resize())
	}

	resize() {
		this.setSize(this._size.width, this._size.height)
		this.setPixelRatio(this._size.pixelRatio)
	}

	async update() {
		if (this.isInitialized) {
			await this.postProcessing.render()
		}
	}
}

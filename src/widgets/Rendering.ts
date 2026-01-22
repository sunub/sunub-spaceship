import Stats from "three/addons/libs/stats.module.js"
import { bloom } from "three/addons/tsl/display/BloomNode.js"
import { pass, renderOutput } from "three/tsl" // 'pow' 제거
import {
    Mesh,
    PostProcessing,
    ReinhardToneMapping,
    WebGPURenderer,
} from "three/webgpu"
import { ServiceRegistry } from "../core/ServiceRegistry"
import type { Size } from "../utils/Size"
import type { Camera } from "./Camera"
import { cheapDOF } from "./Passes/CheapDOF"
import type { Scene } from "./Scene"
import { TweakPane } from "./TweakPane"

export class Rendering {
    private _size!: Size
    private _scene!: Scene
    private _camera!: Camera

    public renderer!: WebGPURenderer

    private postProcessing!: PostProcessing
    public bloomPass!: ReturnType<typeof bloom>
    private cheapDOFPass!: ReturnType<typeof cheapDOF>
    private registry: ServiceRegistry
    private stats: any
    private fpsStats: Stats | null = null

    private bloomPanel: any
    private toneMappingPanel: any
    private blurPanel: any

    constructor() {
        this.registry = ServiceRegistry.getInstance()
    }

    async setRenderer() {
        const registry = this.registry
        this._size = registry.get<Size>("size")
        this._scene = registry.get<Scene>("scene")
        this._camera = registry.get<Camera>("camera")

        this.renderer = new WebGPURenderer({
            canvas: registry.get<HTMLCanvasElement>("canvas"),
            forceWebGL: false,
            antialias: this._size.pixelRatio < 2,
        })
        registry.register("renderer", this.renderer)

        this.renderer.setSize(this._size.width, this._size.height)
        this.renderer.setPixelRatio(this._size.pixelRatio)
        this.renderer.sortObjects = true
        this.renderer.shadowMap.enabled = true
        this.renderer.toneMapping = ReinhardToneMapping
        this.renderer.toneMappingExposure = 1.07 ** 4

        this.renderer.setOpaqueSort((a: any, b: any) => {
            if (a instanceof Mesh && b instanceof Mesh) {
                return a.renderOrder - b.renderOrder
            }
            return 0
        })
        this.setStats()

        return this.renderer.init()
    }

    public setPostProcessing() {
        this.postProcessing = new PostProcessing(this.renderer)

        const scenePass = pass(this._scene, this._camera.instance)
        const scenePassColor = scenePass.getTextureNode("output")

        this.bloomPass = bloom(scenePassColor)
        this.bloomPass.threshold.value = 0.61
        this.bloomPass.strength.value = 0.34
        this.bloomPass.radius.value = 0.95
        this.bloomPass.smoothWidth.value = 0.18

        this.postProcessing.outputNode = this.bloomPass
        this.cheapDOFPass = cheapDOF(renderOutput(scenePass))
        this.postProcessing.outputNode = this.cheapDOFPass.add(this.bloomPass)
        this.setupRenderingDebug()
    }

    async setupRenderingDebug() {
        const urlParams = new URLSearchParams(window.location.search)
        const debugParam = urlParams.get("debug")

        if (debugParam !== "rendering") {
            return
        }

        const pane = TweakPane.getInstance()
        if (this.bloomPanel) this.bloomPanel.dispose()
        if (this.toneMappingPanel) this.toneMappingPanel.dispose()
        if (this.blurPanel) this.blurPanel.dispose()

        this.bloomPanel = pane.addFolder({
            title: "bloom",
            expanded: false,
        })

        this.bloomPanel.addBinding(this.bloomPass.threshold, "value", {
            label: "threshold",
            min: -2,
            max: 2,
            step: 0.01,
        })
        this.bloomPanel.addBinding(this.bloomPass.strength, "value", {
            label: "strength",
            min: -2,
            max: 3,
            step: 0.01,
        })
        this.bloomPanel.addBinding(this.bloomPass.radius, "value", {
            label: "radius",
            min: -2,
            max: 1,
            step: 0.01,
        })
        this.bloomPanel.addBinding(this.bloomPass.smoothWidth, "value", {
            label: "smoothWidth",
            min: -2,
            max: 1,
            step: 0.01,
        })

        this.toneMappingPanel = pane.addFolder({
            title: "toneMapping",
            expanded: false,
        })

        this.toneMappingPanel
            .addBinding(this.renderer, "toneMappingExposure", {
                label: "exposure",
                min: 0,
                max: 2,
                step: 0.01,
            })
            .on("change", (ev: any) => {
                this.renderer.toneMappingExposure = ev.value ** 4.0
            })

        this.blurPanel = pane.addFolder({
            title: "blur",
            expanded: false,
        })

        this.blurPanel
            .addBinding(this.cheapDOFPass.strength, "value", {
                label: "strength",
                min: 0,
                max: 3,
                step: 0.01,
            })
            .on("change", (ev: any) => {
                this.cheapDOFPass.strength.value = ev.value
            })
    }

    private setStats() {
        const urlSearchParams = new URLSearchParams(window.location.search)
        const debugParam = urlSearchParams.get("debug")

        if (debugParam !== "stats") {
            return
        }

        this.fpsStats = new Stats()
        document.body.appendChild(this.fpsStats.dom)

        this.fpsStats.dom.style.transform = "scale(2.0)"
        this.fpsStats.dom.style.transformOrigin = "top left"

        if (!location.hash.match(/stats/i)) return

        this.stats = {}
        this.stats.feed = {}
        this.stats.update = () => {
            this.stats.feed.drawCalls =
                this.renderer.info.render.drawCalls.toLocaleString()
            this.stats.feed.triangles =
                this.renderer.info.render.triangles.toLocaleString()
            this.stats.feed.geometries =
                this.renderer.info.memory.geometries.toLocaleString()
            this.stats.feed.textures =
                this.renderer.info.memory.textures.toLocaleString()
        }

        this.stats.update()

        const debugActive = location.hash.match(/stats/i)
        if (debugActive) {
            const debugPanel = TweakPane.getInstance().addFolder({
                title: "Stats",
                expanded: true,
            })

            for (const feedName in this.stats.feed) {
                debugPanel.addBinding(this.stats.feed, feedName, {
                    readonly: true,
                })
            }
        }
    }

    public async render() {
        if (this.postProcessing) {
            await this.postProcessing.render()
        } else {
            this.renderer.render(this._scene, this._camera.instance)
        }

        if (this.fpsStats) {
            this.fpsStats.update()
        }

        if (this.stats) {
            this.stats.update()
        }
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

    resize() {
        this.renderer.setSize(this._size.width, this._size.height)
        this.renderer.setPixelRatio(this._size.pixelRatio)
        this.setPostProcessing()
    }

    async update() {
        try {
            this.render()
        } catch (e) {
            console.error("Renderer Error detected:", e)
        }
    }
}

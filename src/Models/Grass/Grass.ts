import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js"
import {
    BufferAttribute,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    Object3D,
    Sphere,
    Vector3,
    Box3,
} from "three/webgpu"
import { TweakPane } from "@/Debug/TweakPane"
import { ResourceModel } from "../ResourceModel"
import { GrassMaterial } from "./GrassMaterial"
import type { GrassMaterialOptions } from "./GrassMaterial/GrassMaterial"
import { inject, injectable, unmanaged } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import type { TerrainVisibilityArea } from "@/Services/TerrainVisibilityArea"
import type { Rendering } from "@/core/Rendering"

export interface GrassOptions extends GrassMaterialOptions {
    count?: number
    chunkSize?: number
}

@injectable()
export class Grass extends ResourceModel {
    public grassMaterial: GrassMaterial | null = null
    private grassMeshes: Mesh[] = []
    private surfaceArea: number = 0

    public params: Required<GrassOptions> = {
        width: 0.15,
        height: 1.0,
        segments: 5,
        patchSize: 50.0,
        count: 100000,
        interactionRadius: 3.0,
        chunkSize: 0,
    }

    private time: number = 0

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resoucesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.TerrainVisibilityArea) private terrainVisibilityArea: TerrainVisibilityArea,
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
        @unmanaged() options: GrassOptions = {},
    ) {
        super(resoucesManager, sceneManager, "grassModel", "")
        this.params = { ...this.params, ...options }
    }

    async initialize() {
        await super.initialize()
        this.setUpTweakPane()
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        let surfaceMesh: Mesh | null = null

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                surfaceMesh = child as Mesh
            }
        })

        if (!surfaceMesh) {
            console.error("Grass: No mesh found in grassModel for placement.")
            return
        }

        // Calculate Surface Area (Approximate XZ Plane)
        const box = new Box3().setFromObject(surfaceMesh)
        const size = new Vector3()
        box.getSize(size)
        const width = size.x || 1
        const depth = size.z || 1
        this.surfaceArea = width * depth

        this.initGrass(surfaceMesh)
    }

    private initGrass(surfaceMesh: Mesh) {
        this.setMaterial()

        if (this.grassMaterial) {
            this.createGrassMesh(surfaceMesh)
        }
    }

    private setMaterial() {
        this.grassMaterial = new GrassMaterial({
            segments: this.params.segments,
            patchSize: this.params.patchSize,
            width: this.params.width,
            height: this.params.height,
            interactionRadius: this.params.interactionRadius,
        })
    }

    private createBaseGeometry(): InstancedBufferGeometry {
        const segments = this.params.segments
        const vertices = (segments + 1) * 2
        const indices: number[] = []

        for (let i = 0; i < segments; ++i) {
            const vi = i * 2
            indices[i * 12 + 0] = vi + 0
            indices[i * 12 + 1] = vi + 1
            indices[i * 12 + 2] = vi + 2

            indices[i * 12 + 3] = vi + 2
            indices[i * 12 + 4] = vi + 1
            indices[i * 12 + 5] = vi + 3

            const fi = vertices + vi
            indices[i * 12 + 6] = fi + 2
            indices[i * 12 + 7] = fi + 1
            indices[i * 12 + 8] = fi + 0

            indices[i * 12 + 9] = fi + 3
            indices[i * 12 + 10] = fi + 1
            indices[i * 12 + 11] = fi + 2
        }

        const geometry = new InstancedBufferGeometry()
        geometry.setIndex(indices)
        geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), Infinity)

        const vertexCount = (segments + 1) * 2
        const dummyPositions = new Float32Array(vertexCount * 3)
        geometry.setAttribute(
            "position",
            new BufferAttribute(dummyPositions, 3),
        )

        return geometry
    }

    private createGrassMesh(surfaceMesh: Mesh) {
        if (!this.grassMaterial) return

        const count = this.params.count

        const sampler = new MeshSurfaceSampler(surfaceMesh)
            .setWeightAttribute(null) // Uniform distribution
            .build()

        const geometry = this.createBaseGeometry()
        const instancePositions = new Float32Array(count * 3)
        const tempPosition = new Vector3()

        surfaceMesh.updateMatrixWorld(true)
        const matrixWorld = surfaceMesh.matrixWorld

        for (let i = 0; i < count; i++) {
            sampler.sample(tempPosition)

            tempPosition.applyMatrix4(matrixWorld)

            instancePositions[i * 3 + 0] = tempPosition.x
            instancePositions[i * 3 + 1] = tempPosition.y
            instancePositions[i * 3 + 2] = tempPosition.z
        }

        geometry.setAttribute(
            "aInstancePosition",
            new InstancedBufferAttribute(instancePositions, 3),
        )
        geometry.instanceCount = count

        geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), Infinity)

        const mesh = new Mesh(geometry, this.grassMaterial)
        mesh.frustumCulled = false
        mesh.castShadow = false
        mesh.receiveShadow = true

        this.grassMeshes.push(mesh)
        if (this.modelGroup) {
            this.modelGroup.add(mesh)
        }

        console.log(`[Grass] Distributed ${count} blades across the mesh surface using Sampler.`)
    }

    public update(dt: number) {
        this.time += dt
        if (this.grassMaterial) {
            this.grassMaterial.time = this.time

            const visibilityService = this.terrainVisibilityArea
            if (visibilityService && visibilityService.radius > 0) {
                this.grassMaterial.center = visibilityService.center
                this.grassMaterial.visibleRadius = visibilityService.radius
            }

            const ship = this.sceneManager.getObjectByName("ShipPivot")
            if (ship) {
                this.grassMaterial.playerPosition = ship.position
            }
        }
    }

    private setUpTweakPane() {
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get("debug") !== "grass") return

        const pane = TweakPane.getInstance()
        const folder = pane.addFolder({
            title: "Grass Settings",
            expanded: false,
        })

        folder
            .addBinding(this.params, "width", { min: 0.01, max: 0.5 })
            .on("change", () => this.updateParams({ width: this.params.width }))

        folder
            .addBinding(this.params, "height", { min: 0.1, max: 5.0 })
            .on("change", () =>
                this.updateParams({ height: this.params.height }),
            )

        folder.addBinding(this.params, "count", {
            readonly: true,
            label: "Total Count",
        })
        folder.addBinding(this.params, "chunkSize", {
            readonly: true,
            label: "Chunk Size",
        })

        folder.addButton({ title: "📊 Log Perf Stats" }).on("click", () => {
            this.logOptimizationStats()
        })
    }

    updateParams(params: Partial<GrassOptions>) {
        this.params = { ...this.params, ...params }
        if (this.grassMaterial) {
            this.grassMaterial.setGrassParams(
                this.params.segments,
                this.params.patchSize,
                this.params.width,
                this.params.height,
            )
        }
    }

    private logOptimizationStats() {
        if (!this.rendering) {
            console.warn("Grass: Rendering service not injected.")
            return
        }
        
        // WebGPURenderer might be initialized asynchronously or available directly
        const renderer = this.rendering.renderer
        if (!renderer) {
             console.warn("Grass: Renderer instance is null. Is the game strictly initialized?")
             return
        }

        const info = renderer.info
        const ship = this.sceneManager.getObjectByName("ShipPivot")
        const playerDistText = ship
            ? ` (${this.terrainVisibilityArea.center.distanceTo(ship.position).toFixed(1)}m)`
            : ""

        // --- Quantitative Analysis Logic ---
        const totalCount = this.params.count
        const visibleRadius = this.terrainVisibilityArea.radius
        
        // 1. Calculate Density (Instances per unit area)
        // If surfaceArea is 0 (fallback), avoid division by zero
        const area = this.surfaceArea > 0 ? this.surfaceArea : 10000 // Default fallback area
        const density = totalCount / area
        
        // 2. Calculate Visible Area (Circle area: pi * r^2)
        const visibleArea = Math.PI * Math.pow(visibleRadius, 2)
        
        // 3. Estimated Active Objects
        // If visible area > total area, we clamp to total count
        const estimatedActiveCount = Math.min(Math.floor(density * visibleArea), totalCount)
        
        // 4. Reduction Ratio
        const reductionRatio = ((1 - estimatedActiveCount / totalCount) * 100).toFixed(1)

        console.group(
            "%c 🚀 [Optimization Check] Grass Performance",
            "color: #76ff03; font-weight: bold; font-size: 14px; background: #222; padding: 4px; border-radius: 4px;",
        )

        console.log(
            `%c 1️⃣ Total Instances (Hardcoded): %c${totalCount.toLocaleString()}`,
            "font-weight:bold; color: #ddd",
            "color: #00e676; font-weight: bold",
        )
        
        console.log(
            `%c 2️⃣ Distribution & Culling Metrics:`,
            "font-weight:bold; color: #29b6f6",
        )
        console.log(`   - Total Mesh Area: ${area.toFixed(0)} m²`)
        console.log(`   - Instance Density: ${density.toFixed(2)} per m²`)
        console.log(`   - Current Visible Radius: ${visibleRadius.toFixed(2)}m${playerDistText}`)
        console.log(`   - Visible Area: ${visibleArea.toFixed(0)} m²`)
        
        console.log(
            `%c 3️⃣ Estimated Active Objects (GPU Processed): %c${estimatedActiveCount.toLocaleString()}`,
            "font-weight:bold; color: #ddd",
            "color: #ff9100; font-weight: bold; font-size: 12px",
        )
        console.log(
            `%c    -> Culling Efficiency: %c${reductionRatio}% Reduced`,
            "color: #aaa",
            "color: #00bcd4; font-weight: bold",
        )

        console.log(
            `%c 4️⃣ Draw Calls (Global): %c${info.render.calls || (info.render as any).drawCalls || 0}`,
            "font-weight:bold; color: #ddd",
            "color: #ffca28; font-weight: bold",
        )
        
        console.log(
            `%c 5️⃣ Active Triangles (Scene): %c${info.render.triangles.toLocaleString()}`,
            "font-weight:bold; color: #ddd",
            "color: #ffca28; font-weight: bold",
        )

        console.groupEnd()
    }
}

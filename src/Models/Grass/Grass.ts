import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js"
import {
    BufferAttribute,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    Object3D,
    Sphere,
    Vector3,
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

export interface GrassOptions extends GrassMaterialOptions {
    count?: number
    chunkSize?: number
}

@injectable()
export class Grass extends ResourceModel {
    public grassMaterial: GrassMaterial | null = null
    private grassMeshes: Mesh[] = []

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
        mesh.castShadow = true
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
}

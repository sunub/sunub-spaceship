import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js"
import {
    Box3,
    BufferAttribute,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Matrix4,
    Mesh,
    Object3D,
    Sphere,
    Vector3,
} from "three/webgpu"
import type { GameContext } from "@/core/GameContext"
import { TweakPane } from "@/widgets/TweakPane"
import { BaseModel } from "../BaseModel"
import { GrassMaterial } from "./GrassMaterial"
import type { GrassMaterialOptions } from "./GrassMaterial/GrassMaterial"

export interface GrassOptions extends GrassMaterialOptions {
    count?: number
    chunkSize?: number
}

export class Grass extends BaseModel {
    public grassMaterial: GrassMaterial | null = null
    private grassMeshes: Mesh[] = []
    private sampler: MeshSurfaceSampler | null = null

    public params: Required<GrassOptions> = {
        width: 0.5,
        height: 1.0,
        segments: 5,
        patchSize: 1.0,
        count: 100000,
        interactionRadius: 3.0,
        chunkSize: 10.0,
    }

    private time: number = 0

    constructor(options: GrassOptions = {}) {
        super("grassModel")
        this.params = { ...this.params, ...options }
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
            console.error("Grass: No mesh found in grassModel for sampling.")
            return
        }

        this.sampler = new MeshSurfaceSampler(surfaceMesh as Mesh).build()
        this.initGrass(surfaceMesh as Mesh)
    }

    private initGrass(surfaceMesh: Mesh) {
        this.setMaterial()

        if (this.grassMaterial) {
            this.plantGrassChunks(surfaceMesh)
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

    private plantGrassChunks(surfaceMesh: Mesh) {
        if (!this.sampler || !this.grassMaterial) return

        const chunkMap = new Map<string, number[]>()
        const tempPosition = new Vector3()
        const tempNormal = new Vector3()
        const transformMatrix = new Matrix4()

        surfaceMesh.updateMatrixWorld(true)
        transformMatrix.copy(surfaceMesh.matrixWorld)

        for (let i = 0; i < this.params.count; i++) {
            this.sampler.sample(tempPosition, tempNormal)
            tempPosition.applyMatrix4(transformMatrix)

            const chunkX = Math.floor(tempPosition.x / this.params.chunkSize)
            const chunkZ = Math.floor(tempPosition.z / this.params.chunkSize)
            const key = `${chunkX}_${chunkZ}`

            if (!chunkMap.has(key)) {
                chunkMap.set(key, [])
            }

            const chunk = chunkMap.get(key)
            if (chunk) {
                chunk.push(tempPosition.x, tempPosition.y, tempPosition.z)
            }
        }

        chunkMap.forEach((positions) => {
            const count = positions.length / 3
            if (count === 0) return

            const geometry = this.createBaseGeometry()
            const instancePositions = new Float32Array(positions)

            geometry.setAttribute(
                "aInstancePosition",
                new InstancedBufferAttribute(instancePositions, 3),
            )
            geometry.instanceCount = count

            const box = new Box3()
            const v = new Vector3()

            for (let i = 0; i < count; i++) {
                v.set(
                    instancePositions[i * 3],
                    instancePositions[i * 3 + 1],
                    instancePositions[i * 3 + 2],
                )
                box.expandByPoint(v)
            }

            const sphere = new Sphere()
            box.getBoundingSphere(sphere)
            sphere.radius += this.params.height * 2.0

            geometry.boundingSphere = sphere

            if (!this.grassMaterial) return

            const mesh = new Mesh(geometry, this.grassMaterial)
            mesh.frustumCulled = true
            mesh.castShadow = true
            mesh.receiveShadow = true

            this.grassMeshes.push(mesh)
            if (this.modelGroup) {
                this.modelGroup.add(mesh)
            }
        })

        console.log(
            `[Grass] Created ${this.grassMeshes.length} chunks for ${this.params.count} blades.`,
        )
    }

    public update(deltaTime: number) {
        this.time += deltaTime
        if (this.grassMaterial) {
            this.grassMaterial.time = this.time * 0.001

            if (this.context) {
                const ship = this.context.scene.getObjectByName("ShipPivot")
                if (ship) {
                    this.grassMaterial.playerPosition = ship.position
                }
            }
        }
    }

    async initialize(context: GameContext) {
        await super.initialize(context)
        this.setUpTweakPane()
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

import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js"
import {
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
import { GrassMaterial } from "@/widgets/Materials/GrassMaterial"
import type { GrassMaterialOptions } from "@/widgets/Materials/GrassMaterial/GrassMaterial"
import { TweakPane } from "@/widgets/TweakPane"
import { BaseModel } from "../BaseModel"

export interface GrassOptions extends GrassMaterialOptions {
    count?: number
}

export class Grass extends BaseModel {
    public grassMaterial: GrassMaterial | null = null
    private grassMesh: Mesh | null = null
    private sampler: MeshSurfaceSampler | null = null

    public params: Required<GrassOptions> = {
        width: 0.1,
        height: 1.0,
        segments: 5,
        patchSize: 1.0,
        count: 20000,
        interactionRadius: 3.0,
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

        // Create Sampler
        this.sampler = new MeshSurfaceSampler(surfaceMesh as Mesh).build()

        this.initGrass(surfaceMesh as Mesh)

        if (this.grassMesh) {
            this.modelGroup.add(this.grassMesh)
        }
    }

    private initGrass(surfaceMesh: Mesh) {
        this.setGeometry()
        this.setMaterial()

        if (this.geometry && this.grassMaterial) {
            this.grassMesh = new Mesh(this.geometry, this.grassMaterial)
            this.grassMesh.frustumCulled = false
            this.grassMesh.castShadow = true
            this.grassMesh.receiveShadow = true

            this.plantGrass(surfaceMesh)
        }
    }

    private geometry: InstancedBufferGeometry | null = null

    private setGeometry() {
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

        this.geometry = new InstancedBufferGeometry()
        this.geometry.instanceCount = 0
        this.geometry.setIndex(indices)
        this.geometry.boundingSphere = new Sphere(
            new Vector3(0, 0, 0),
            Infinity,
        )

        const positions = new Float32Array(this.params.count * 3)
        this.geometry.setAttribute(
            "aInstancePosition",
            new InstancedBufferAttribute(positions, 3),
        )

        const vertexCount = (segments + 1) * 2
        const dummyPositions = new Float32Array(vertexCount * 3)
        this.geometry.setAttribute(
            "position",
            new BufferAttribute(dummyPositions, 3),
        )
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

    private plantGrass(surfaceMesh?: Mesh) {
        if (!this.sampler || !this.geometry) return

        const attribute = this.geometry.getAttribute(
            "aInstancePosition",
        ) as InstancedBufferAttribute
        const array = attribute.array as Float32Array

        const tempPosition = new Vector3()
        const tempNormal = new Vector3()

        const transformMatrix = new Matrix4()
        if (surfaceMesh) {
            surfaceMesh.updateMatrixWorld(true)
            transformMatrix.copy(surfaceMesh.matrixWorld)
        }

        for (let i = 0; i < this.params.count; i++) {
            this.sampler.sample(tempPosition, tempNormal)
            tempPosition.applyMatrix4(transformMatrix)

            array[i * 3 + 0] = tempPosition.x
            array[i * 3 + 1] = tempPosition.y
            array[i * 3 + 2] = tempPosition.z
        }

        this.geometry.instanceCount = this.params.count
        attribute.needsUpdate = true
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
        const debugParam = urlParams.get("debug")

        if (debugParam !== "grass") {
            return
        }

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
            label: "Count",
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

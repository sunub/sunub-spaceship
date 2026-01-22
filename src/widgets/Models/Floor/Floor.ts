import * as RAPIER from "@dimforge/rapier3d-compat"
import type { Mesh } from "three"
import { color, vec3 } from "three/tsl"
import { Box3, Object3D, Vector3 } from "three/webgpu"
import type { GameContext } from "@/core/GameContext"
import { GridMaterial } from "@/widgets/Materials/GridMaterial"
import type { Physics } from "@/widgets/Physics"
import { TweakPane } from "@/widgets/TweakPane"
import { BaseModel } from "../BaseModel"

export class Floor extends BaseModel {
    private gridMaterial: GridMaterial
    private gridOptions: {
        gridDensity: number
        gridThickness: number
    } = {
        gridDensity: 1.0,
        gridThickness: 0.01,
    }
    private colliderMeshes: Mesh[] = []

    constructor() {
        super("floorModel")

        this.gridMaterial = new GridMaterial({
            gridDensity: this.gridOptions.gridDensity,
            gridThickness: this.gridOptions.gridThickness,
        })
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        this.mesh = clonedModel

        const box = new Box3().setFromObject(clonedModel)
        const centerOffset = box.getCenter(new Vector3())

        this.mesh.position.set(-centerOffset.x, -box.min.y, -centerOffset.z)

        this.mesh.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh

                this.colliderMeshes.push(mesh)
                mesh.castShadow = false
                mesh.receiveShadow = true
                mesh.material = this.gridMaterial
                mesh.frustumCulled = false
            }
        })

        this.modelGroup.add(this.mesh)
    }

    async initialize(context: GameContext) {
        this.context = context
        this.setUpTweakPane()

        await super.initialize(context)
    }

    public update(_: number) {}

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.context?.physics && this.mesh) {
            this.createPhysicsBody(this.context.physics)
        }
    }

    private createPhysicsBody(physics: Physics) {
        if (!this.modelGroup || !this.mesh) {
            return
        }

        // RigidBody를 무조건 (0,0,0) / 회전 0으로 고정합니다.
        // 이미 아래에서 applyMatrix4를 통해 버텍스들이 "제자리"를 찾아갔기 때문에
        // RigidBody가 또 움직이면 위치가 이중으로 적용됩니다.
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, 0, 0)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 }) // 회전도 초기화 (Identity)

        this.rigidBody = physics.world.createRigidBody(rigidBodyDesc)

        const targetMeshes =
            this.colliderMeshes.length > 0 ? this.colliderMeshes : []

        if (targetMeshes.length === 0) {
            this.mesh.traverse((c) => {
                if ((c as Mesh).isMesh) targetMeshes.push(c as Mesh)
            })
        }

        targetMeshes.forEach((mesh) => {
            const geometry = mesh.geometry
            if (!geometry) return

            // 매트릭스 업데이트 순서 보장
            // mesh.matrixWorld가 부모(modelGroup)의 변경 사항까지 확실히 반영하도록
            // 부모부터 업데이트를 해주는 것이 안전합니다.
            if (this.modelGroup) {
                this.modelGroup.updateMatrixWorld(true)
            }
            mesh.updateMatrixWorld(true)

            const clonedGeom = geometry.clone()
            clonedGeom.applyMatrix4(mesh.matrixWorld)

            const positions = clonedGeom.attributes.position.array
            const indices = clonedGeom.index
                ? clonedGeom.index.array
                : undefined

            let indicesArray: Uint32Array
            if (indices) {
                indicesArray = new Uint32Array(indices)
            } else {
                const vertexCount = positions.length / 3
                indicesArray = new Uint32Array(vertexCount)
                for (let i = 0; i < vertexCount; i++) {
                    indicesArray[i] = i
                }
            }

            const colliderDesc = RAPIER.ColliderDesc.trimesh(
                positions as Float32Array,
                indicesArray,
            )

            colliderDesc.setFriction(1.0)
            colliderDesc.setRestitution(0.1)
            colliderDesc.setCollisionGroups(0x00020001)

            if (this.rigidBody) {
                physics.world.createCollider(colliderDesc, this.rigidBody)
            }

            clonedGeom.dispose()
        })
    }

    private setUpTweakPane() {
        const urlParams = new URLSearchParams(window.location.search)
        const debugParam = urlParams.get("debug")

        if (debugParam !== "floor") {
            return
        }

        const pane = TweakPane.getInstance()

        const f = pane.addFolder({
            title: "Grid Material",
            expanded: true,
        })

        f.addBinding(this.gridOptions, "gridDensity", {
            min: 0.1,
            max: 16.0,
            step: 0.1,
            label: "Grid Density",
        }).on("change", (ev: any) => {
            this.gridMaterial.gridDensity = ev.value
        })

        f.addBinding(this.gridOptions, "gridThickness", {
            min: 0.001,
            max: 0.1,
            step: 0.001,
            label: "Grid Thickness",
        }).on("change", (ev: any) => {
            this.gridMaterial.gridThickness = ev.value
        })
    }

    public terrainNode(_position: any) {
        return vec3(0)
    }

    public colorNode(_terrainData: any) {
        return color(0x0a0a0a)
    }
}

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

    private floorWidth: number = 0
    private floorDepth: number = 0

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = `${this.modelName}Group`

        this.mesh = clonedModel

        const box = new Box3().setFromObject(clonedModel)
        const size = new Vector3()
        box.getSize(size)
        this.floorWidth = size.x
        this.floorDepth = size.z

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

        // 1. 바닥(Floor) Collider 생성
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
            colliderDesc.setCollisionGroups((0x0001 << 16) | 0xffff)

            if (this.rigidBody) {
                physics.world.createCollider(colliderDesc, this.rigidBody)
            }

            clonedGeom.dispose()
        })

        // 2. 가장자리 벽(Invisible Walls) Collider 생성
        this.createBoundaryColliders(physics)
    }

    private createBoundaryColliders(physics: Physics) {
        if (!this.rigidBody) return

        const wallHeight = 500
        const wallThickness = 10
        const halfWidth = this.floorWidth / 2
        const halfDepth = this.floorDepth / 2
        const halfHeight = wallHeight / 2
        const halfThickness = wallThickness / 2

        // Wall configurations: [hx, hy, hz, x, y, z]
        // RAPIER cuboid takes half-extents
        const walls = [
            // North (+Z)
            {
                hx: halfWidth + wallThickness, // 코너 빈틈 방지를 위해 조금 더 길게
                hy: halfHeight,
                hz: halfThickness,
                x: 0,
                y: halfHeight - 10, // 바닥보다 조금 아래에서 시작
                z: halfDepth + halfThickness,
            },
            // South (-Z)
            {
                hx: halfWidth + wallThickness,
                hy: halfHeight,
                hz: halfThickness,
                x: 0,
                y: halfHeight - 10,
                z: -(halfDepth + halfThickness),
            },
            // East (+X)
            {
                hx: halfThickness,
                hy: halfHeight,
                hz: halfDepth,
                x: halfWidth + halfThickness,
                y: halfHeight - 10,
                z: 0,
            },
            // West (-X)
            {
                hx: halfThickness,
                hy: halfHeight,
                hz: halfDepth,
                x: -(halfWidth + halfThickness),
                y: halfHeight - 10,
                z: 0,
            },
        ]

        walls.forEach((w) => {
            const wallDesc = RAPIER.ColliderDesc.cuboid(w.hx, w.hy, w.hz)
                .setTranslation(w.x, w.y, w.z)
                .setFriction(0)
                .setRestitution(0)
                .setCollisionGroups((0x0002 << 16) | 0xffff)
            if (this.rigidBody) {
                physics.world.createCollider(wallDesc, this.rigidBody)
            }
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

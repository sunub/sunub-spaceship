import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import { inject, injectable } from "inversify"
import { texture } from "three/tsl"
import type { BufferGeometry, Material, Matrix4, Mesh } from "three/webgpu"
import { InstancedMesh, Object3D } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import { ResourceModel } from "../ResourceModel"

@injectable()
export class TreeLights extends ResourceModel {
    private colliderMeshes: Mesh[] = []

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resoucesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.PhysicsService)
        private readonly physicsService: IPhysicsService,
    ) {
        super(
            resoucesManager,
            sceneManager,
            "treeLightsModel",
            "treeLightsTexture",
        )
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "TreeLightsGroup"

        // 인스턴스로 데이터를 불러올 경우에는 js 는 Lazy Evaluation을 사용하기 때문
        // 3D 엔진에서 Matrix 계산은 꽤 비용이 비싸기 때문에 즉시 변경되지 않고
        // renderer.render() 호출 시에만 계산됨

        // updateMatrixWorld()를 강제로 호출해주지 않으면
        // js는 아직 계산되지 않았기 때문에 행렬이 (0,0,0) 으로 위치가 초기화 되버린다
        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel // Fallback reference

        // 고유 지오메트리별로 데이터 수집
        // Key: Geometry UUID, Value: { geometry, material, matrices }
        const instancesMap = new Map<
            string,
            {
                geometry: BufferGeometry
                material: Material
                matrices: Matrix4[]
            }
        >()

        const treeLightTexture = this.loadTexture()
        if (!treeLightTexture) {
            return
        }

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry
                const newMat = new MeshDefaultMaterial({
                    colorNode: texture(treeLightTexture),
                    emissionNode: texture(treeLightTexture).mul(2.5),
                    hasCoreShadows: false,
                    hasLightBounce: false,
                })

                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        material: newMat,
                        matrices: [],
                    })
                }

                const groupData = instancesMap.get(geometry.uuid)

                if (groupData) {
                    groupData.matrices.push(mesh.matrixWorld.clone())
                }
            }
        })

        if (instancesMap.size === 0) {
            console.error("TreeLights 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, material, matrices } = data

            const instancedMesh = new InstancedMesh(
                geometry,
                material,
                matrices.length,
            )
            instancedMesh.name = `${this.modelName}_${geometry.uuid}`
            instancedMesh.castShadow = false
            instancedMesh.receiveShadow = false
            instancedMesh.frustumCulled = false

            for (let i = 0; i < matrices.length; i++) {
                instancedMesh.setMatrixAt(i, matrices[i])
            }

            instancedMesh.instanceMatrix.needsUpdate = true
            if (this.modelGroup) {
                this.modelGroup.add(instancedMesh)
            }
        })
    }

    protected async setupPhysics(): Promise<void> {
        if (!this.modelGroup || !this.mesh) {
            return
        }

        const rigidBodyDesc = RigidBodyDesc.fixed()
            .setTranslation(0, 0, 0)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 })

        const rigidBody = this.physicsService.createPhysicsBody(rigidBodyDesc)

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

            // Create Trimesh Collider
            const colliderDesc = ColliderDesc.trimesh(
                positions as Float32Array,
                indicesArray,
            )

            colliderDesc.setFriction(1.0)
            colliderDesc.setRestitution(0.1) // Low restitution for mountains
            colliderDesc.setCollisionGroups((0x0002 << 16) | 0xffff)

            this.physicsService.createCollider(colliderDesc, rigidBody)
            clonedGeom.dispose()
        })
    }

    public update(_deltaTime: number): void {}
}

import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import {
    type BufferGeometry,
    InstancedMesh,
    type Matrix4,
    type Mesh,
    type MeshStandardMaterial,
    Object3D,
} from "three/webgpu"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import { CrystalMaterial } from "@/Materials/CrystalMaterial"
import { ResourceModel } from "../ResourceModel"

@injectable()
export class BrightCrystal extends ResourceModel {
    private colliderMeshes: Mesh[] = []

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.PhysicsService) private readonly physicsService: IPhysicsService,
    ) {
        super(resourcesManager, sceneManager, "brightCrystalModel")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "BrightCrystalGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel // Fallback reference

        const instancesMap = new Map<
            string,
            {
                geometry: BufferGeometry
                originalMaterial: MeshStandardMaterial
                matrices: Matrix4[]
            }
        >()

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry
                const material = mesh.material as MeshStandardMaterial

                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        originalMaterial: material,
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
            console.error("BrightCrystal 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, matrices } = data
            const crystalMat = new CrystalMaterial({
                color: 0x7641ed, // 베이스
                coreColor: 0xb9abff, // 에너지
                rimColor: 0xffffff, // 가장자리
                noiseScale: 1.5,
                flowSpeed: 0.5, // 에너지가 흐르는 속도
            })
            // crystalMat.emissiveMap // Original had this, probably commented out or incomplete?

            const instancedMesh = new InstancedMesh(
                geometry,
                crystalMat,
                matrices.length,
            )
            instancedMesh.castShadow = true
            instancedMesh.receiveShadow = true

            for (let i = 0; i < matrices.length; i++) {
                instancedMesh.setMatrixAt(i, matrices[i])
            }

            instancedMesh.instanceMatrix.needsUpdate = true
            if (this.modelGroup) {
                this.modelGroup.add(instancedMesh)
            }
        })
    }

    public update(_deltaTime: number): void {
        // Static or simple animation
    }

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.mesh) {
            this.createPhysicsBody()
        }
    }

    private createPhysicsBody() {
        if (!this.modelGroup || !this.mesh) {
            return
        }

        // Create a fixed rigid body at (0,0,0) with no rotation
        const rigidBodyDesc = RigidBodyDesc.fixed()
            .setTranslation(0, 0, 0)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 })

        this.rigidBody = this.physicsService.createPhysicsBody(rigidBodyDesc)

        const targetMeshes =
            this.colliderMeshes.length > 0 ? this.colliderMeshes : []

        // Fallback if no meshes found in colliderMeshes (unlikely if traverse worked)
        if (targetMeshes.length === 0) {
            this.mesh.traverse((c) => {
                if ((c as Mesh).isMesh) targetMeshes.push(c as Mesh)
            })
        }

        targetMeshes.forEach((mesh) => {
            const geometry = mesh.geometry
            if (!geometry) return

            // Ensure matrix world is up to date
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
            colliderDesc.setRestitution(0.1) // Low restitution
            colliderDesc.setCollisionGroups((0x0002 << 16) | 0xffff)

            if (this.rigidBody) {
                this.physicsService.createCollider(colliderDesc, this.rigidBody)
            }

            clonedGeom.dispose()
        })
    }
}

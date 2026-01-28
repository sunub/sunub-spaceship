// 📦 Rapier 물리 엔진 임포트
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import { color } from "three/tsl"
import * as THREE from "three/webgpu"
import type { Physics } from "@/widgets/Physics"
import { MeshDefaultMaterial } from "../../Materials/MeshDefaultMaterial"
import { BaseModel } from "../BaseModel"

export class CrystalStructure extends BaseModel {
    constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
        super("crystalStructure", position)
    }

    protected setupModelStructure(clonedModel: THREE.Object3D): void {
        this.modelGroup = new THREE.Object3D()
        this.modelGroup.name = "CrystalStructureGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel

        const instancesMap = new Map<
            string,
            {
                geometry: THREE.BufferGeometry
                originalMaterial: THREE.MeshStandardMaterial
                matrices: THREE.Matrix4[]
            }
        >()

        clonedModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                const geometry = mesh.geometry
                const material = mesh.material as THREE.MeshStandardMaterial

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
            console.error("CrystalStructure 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, originalMaterial, matrices } = data

            const materialParams: any = {}

            if (originalMaterial.color) {
                materialParams.colorNode = color(originalMaterial.color)
            }

            const defaultMaterial = new MeshDefaultMaterial(materialParams)

            const instancedMesh = new THREE.InstancedMesh(
                geometry,
                defaultMaterial,
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

    // ─────────────────────────────────────────────────────────────────────────────
    // ⚙️ PHYSICS SETUP
    // ─────────────────────────────────────────────────────────────────────────────

    protected async setupPhysics(): Promise<void> {
        if (!this.rigidBody && this.context?.physics && this.modelGroup) {
            this.createPhysicsBody(this.context.physics)
        }
    }

    private createPhysicsBody(physics: Physics) {
        if (!this.modelGroup) return

        // 1. 모델의 정확한 시각적 중심과 크기 계산
        // (이 박스는 (0,0,0) 원점을 기준으로 모델이 어디에 치우쳐져 있는지 알려줍니다)
        const box = new THREE.Box3().setFromObject(this.modelGroup)

        const size = new THREE.Vector3()
        box.getSize(size) // 모델의 전체 크기 {w, h, d}

        const center = new THREE.Vector3()
        box.getCenter(center) // 모델의 중심 좌표 (Offset)

        // 2. RigidBody 생성 (고정 위치)
        // RigidBody는 우리가 지정한 월드 좌표(this.position)에 생성합니다.
        const rigidBodyDesc = RigidBodyDesc.fixed()
            .setTranslation(this.position.x, this.position.y, this.position.z)
            .setRotation({ x: 0, y: 0, z: 0, w: 1 })

        this.rigidBody = physics.world.createRigidBody(rigidBodyDesc)

        // 3. Collider 크기 설정
        // 원형 기둥 반지름: 가로(X)와 깊이(Z) 중 가장 큰 쪽의 절반
        const radius = Math.max(size.x, size.z) / 2
        const halfHeight = size.y / 2

        const colliderDesc = ColliderDesc.cylinder(halfHeight, radius)

        // 🛑 [핵심 수정] Collider 오프셋 보정
        // 모델이 원점(0,0,0)에서 벗어나 있다면, 그만큼 Collider도 이동시켜야 겹칩니다.
        // center 변수가 바로 그 '벗어난 정도'를 담고 있습니다.
        colliderDesc.setTranslation(center.x, center.y, center.z)

        // 5. 물리 속성 및 충돌 그룹 설정
        colliderDesc.setFriction(1.0)
        colliderDesc.setRestitution(0.1)

        // 장애물 그룹(Group 2) 설정 -> 우주선이 인식하고 멈춤
        colliderDesc.setCollisionGroups((0x0002 << 16) | 0xffff)

        // 6. RigidBody에 Collider 부착
        physics.world.createCollider(colliderDesc, this.rigidBody)
    }

    public update(_deltaTime: number): void {
        // Static mesh, no update needed
    }
}

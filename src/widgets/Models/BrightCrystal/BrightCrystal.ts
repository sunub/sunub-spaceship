import {
    type BufferGeometry,
    InstancedMesh,
    type Matrix4,
    type Mesh,
    type MeshStandardMaterial,
    Object3D,
    Vector3,
} from "three/webgpu"
import { CrystalMaterial } from "@/widgets/Materials/CrystalMaterial"
import { BaseModel } from "../BaseModel"

export class BrightCrystal extends BaseModel {
    constructor(position: Vector3 = new Vector3(0, 0, 0)) {
        super("brightCrystalModel", position)
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "BrightCrystalGroup"

        clonedModel.updateMatrixWorld(true)

        this.mesh = clonedModel // Fallback reference

        // 지오메트리/머티리얼별로 데이터 수집
        // Key: Geometry UUID + Material UUID, Value: { geometry, material, matrices }
        // 단순화를 위해 Geometry UUID를 키로 사용하되, Material 변환은 각 그룹 생성 시 수행)
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
            crystalMat.emissiveMap

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
}

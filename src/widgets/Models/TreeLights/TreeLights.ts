import { texture } from "three/tsl"
import type {
    BufferGeometry,
    Material,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Texture,
} from "three/webgpu"
import { InstancedMesh, Object3D, Vector3 } from "three/webgpu"
import { ServiceRegistry } from "@/core/ServiceRegistry"
import type Resources from "@/utils/Resources"

import { BaseModel } from "../BaseModel"

export class TreeLights extends BaseModel {
    private serviceRegistry = ServiceRegistry.getInstance()
    private resources: Resources =
        this.serviceRegistry.get<Resources>("resources")

    constructor(position: Vector3 = new Vector3(0, 0, 0)) {
        super("treeLightsModel", position)
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

        const treeLightTexture = this.resources.items
            .treeLightsTexture as Texture

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry
                const material = mesh.material as MeshStandardMaterial

                material.colorNode = texture(treeLightTexture)

                // 지오메트리 ID로 그룹화
                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        material: material,
                        matrices: [],
                    })
                }

                const groupData = instancesMap.get(geometry.uuid)

                // 해당 메쉬의 월드 매트릭스 복제하여 저장
                // (clonedModel은 Scene에 추가되지 않은 상태이므로, 이 매트릭스는 모델 루트 기준의 변환값과 동일함)
                if (groupData) {
                    groupData.matrices.push(mesh.matrixWorld.clone())
                }
            }
        })

        if (instancesMap.size === 0) {
            console.error("TreeLights 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        // 각 그룹별 InstancedMesh 생성
        instancesMap.forEach((data, _) => {
            const { geometry, material, matrices } = data

            const instancedMesh = new InstancedMesh(
                geometry,
                material,
                matrices.length,
            )
            instancedMesh.castShadow = true
            instancedMesh.receiveShadow = true
            // instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage)

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

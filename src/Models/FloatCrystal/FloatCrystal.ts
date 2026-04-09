import { inject, injectable } from "inversify"
import {
    type BufferGeometry,
    DynamicDrawUsage,
    InstancedMesh,
    type Material,
    Matrix4,
    type Mesh,
    Object3D,
    Quaternion,
    Vector3,
} from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { CrystalMaterial } from "@/Materials/CrystalMaterial"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"
import type Time from "@/utils/Time"
import { ResourceModel } from "../ResourceModel"

type FloatCrystalMotion = {
    basePosition: Vector3
    baseQuaternion: Quaternion
    baseScale: Vector3
    amplitude: number
    speed: number
    phase: number
    direction: 1 | -1
    driftX: number
    driftZ: number
}

type FloatCrystalInstanceGroup = {
    mesh: InstancedMesh
    motions: FloatCrystalMotion[]
}

@injectable()
export class FloatCrystal extends ResourceModel {
    private readonly instanceGroups: FloatCrystalInstanceGroup[] = []
    private readonly tempPosition = new Vector3()
    private readonly tempMatrix = new Matrix4()
    private readonly tempQuaternion = new Quaternion()
    private readonly tempOffsetQuaternion = new Quaternion()
    private readonly axisZ = new Vector3(0, 0, 1)
    private readonly tickHandler = () => {
        this.animate()
    }
    private lastAppliedElapsed = -1

    constructor(
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resourcesManager: IResourceService,
        @inject(GAME_CONTEXT.MANAGER.SceneManager) sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.UTILITY.Time) private readonly time: Time,
    ) {
        super(resourcesManager, sceneManager, "floatCrystalModel")
    }

    protected setupModelStructure(clonedModel: Object3D): void {
        this.modelGroup = new Object3D()
        this.modelGroup.name = "FloatCrystalGroup"
        this.instanceGroups.length = 0
        this.lastAppliedElapsed = -1
        this.time.off("tick", this.tickHandler)

        clonedModel.updateMatrixWorld(true)
        this.mesh = clonedModel

        const instancesMap = new Map<
            string,
            {
                geometry: BufferGeometry
                material: Material
                motions: FloatCrystalMotion[]
            }
        >()

        clonedModel.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh
                const geometry = mesh.geometry
                const crystalMat = new CrystalMaterial({
                    color: 0x3366ff, // 베이스
                    coreColor: 0x00ffff, // 에너지
                    rimColor: 0xffffff, // 가장자리
                    noiseScale: 1.2,
                    flowSpeed: 0.5, // 에너지가 흐르는 속도
                })

                if (!instancesMap.has(geometry.uuid)) {
                    instancesMap.set(geometry.uuid, {
                        geometry: geometry,
                        material: crystalMat,
                        motions: [],
                    })
                }

                mesh.castShadow = true
                mesh.receiveShadow = true
                const groupData = instancesMap.get(geometry.uuid)
                if (groupData) {
                    groupData.motions.push(
                        this.createInstanceMotion(
                            mesh.matrixWorld,
                            geometry.uuid,
                            groupData.motions.length,
                        ),
                    )
                }
            }
        })

        if (instancesMap.size === 0) {
            console.error("FloatCrystal 모델에서 Mesh를 찾을 수 없습니다.")
            return
        }

        instancesMap.forEach((data, _) => {
            const { geometry, material, motions } = data

            const instancedMesh = new InstancedMesh(
                geometry,
                material,
                motions.length,
            )
            instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage)
            instancedMesh.frustumCulled = false

            instancedMesh.castShadow = true
            instancedMesh.receiveShadow = true

            for (let i = 0; i < motions.length; i++) {
                this.applyBaseMatrix(instancedMesh, motions[i], i)
            }

            instancedMesh.instanceMatrix.needsUpdate = true
            if (this.modelGroup) {
                this.modelGroup.add(instancedMesh)
            }

            this.instanceGroups.push({
                mesh: instancedMesh,
                motions,
            })
        })

        this.time.on("tick", this.tickHandler)
    }

    public update(_deltaTime: number): void {
        this.animate()
    }

    private createInstanceMotion(
        matrix: Matrix4,
        seed: string,
        index: number,
    ): FloatCrystalMotion {
        const basePosition = new Vector3()
        const baseQuaternion = new Quaternion()
        const baseScale = new Vector3()

        matrix.decompose(basePosition, baseQuaternion, baseScale)

        const hash = this.hashString(`${seed}:${index}`)
        const amplitude = this.lerp(
            0.16,
            0.38,
            this.hashToUnit(hash ^ 0x9e3779b9),
        )
        const speed = this.lerp(0.6, 1.7, this.hashToUnit(hash ^ 0x85ebca6b))
        const phase = this.hashToUnit(hash ^ 0xc2b2ae35) * Math.PI * 2
        const direction: 1 | -1 =
            this.hashToUnit(hash ^ 0x27d4eb2d) > 0.5 ? 1 : -1
        const driftX = this.lerp(0.04, 0.14, this.hashToUnit(hash ^ 0x165667b1))
        const driftZ = this.lerp(0.04, 0.14, this.hashToUnit(hash ^ 0xd3a2646c))

        return {
            basePosition,
            baseQuaternion,
            baseScale,
            amplitude,
            speed,
            phase,
            direction,
            driftX,
            driftZ,
        }
    }

    private applyMotionMatrix(
        mesh: InstancedMesh,
        motion: FloatCrystalMotion,
        index: number,
        elapsedTime: number,
    ): void {
        const primaryWave = Math.sin(elapsedTime * motion.speed + motion.phase)
        const secondaryWave = Math.sin(
            elapsedTime * motion.speed * 0.43 + motion.phase * 1.7,
        )
        const tertiaryWave = Math.cos(
            elapsedTime * motion.speed * 0.27 + motion.phase * 0.9,
        )
        const floatOffset =
            primaryWave * motion.amplitude * motion.direction +
            secondaryWave * motion.amplitude * 0.5 +
            tertiaryWave * motion.amplitude * 0.24

        this.tempPosition.copy(motion.basePosition)
        this.tempPosition.x +=
            secondaryWave * motion.driftX + tertiaryWave * motion.driftX * 0.5
        this.tempPosition.y += floatOffset
        this.tempPosition.z +=
            primaryWave * motion.driftZ + secondaryWave * motion.driftZ * 0.35

        const tilt =
            Math.sin(elapsedTime * motion.speed * 0.8 + motion.phase) * 0.14
        this.tempQuaternion.copy(motion.baseQuaternion)
        this.tempOffsetQuaternion.setFromAxisAngle(
            this.axisZ,
            tilt * motion.direction,
        )
        this.tempQuaternion.multiply(this.tempOffsetQuaternion)

        this.tempMatrix.compose(
            this.tempPosition,
            this.tempQuaternion,
            motion.baseScale,
        )
        mesh.setMatrixAt(index, this.tempMatrix)
    }

    private applyBaseMatrix(
        mesh: InstancedMesh,
        motion: FloatCrystalMotion,
        index: number,
    ): void {
        this.tempMatrix.compose(
            motion.basePosition,
            motion.baseQuaternion,
            motion.baseScale,
        )
        mesh.setMatrixAt(index, this.tempMatrix)
    }

    private animate(): void {
        if (!this.instanceGroups.length) {
            return
        }

        const elapsedTime = this.time.elapsed * 0.001
        if (elapsedTime === this.lastAppliedElapsed) {
            return
        }
        this.lastAppliedElapsed = elapsedTime

        this.instanceGroups.forEach(({ mesh, motions }) => {
            for (let i = 0; i < motions.length; i++) {
                this.applyMotionMatrix(mesh, motions[i], i, elapsedTime)
            }

            mesh.instanceMatrix.needsUpdate = true
        })
    }

    private hashString(value: string): number {
        let hash = 0
        for (let i = 0; i < value.length; i++) {
            hash = (hash << 5) - hash + value.charCodeAt(i)
            hash |= 0
        }
        return hash
    }

    private hashToUnit(value: number): number {
        const normalized = Math.abs(value) % 10000
        return normalized / 9999
    }

    private lerp(min: number, max: number, t: number): number {
        return min + (max - min) * t
    }

    public override dispose(): void {
        this.time.off("tick", this.tickHandler)
        this.instanceGroups.length = 0
        this.lastAppliedElapsed = -1
        super.dispose()
    }
}

import {
    attribute,
    cos,
    cross,
    Fn,
    float,
    If,
    instanceIndex,
    int,
    Loop,
    mix,
    normalize,
    positionLocal,
    sin,
    storage,
    uniform,
    vec3,
} from "three/tsl"
import {
    DoubleSide,
    Group,
    InstancedMesh,
    StorageInstancedBufferAttribute,
    Vector3,
} from "three/webgpu"
import type { GameContext, IGameObject } from "@/core/GameContext"
// 프로젝트 환경에 맞는 Material import
import { MeshDefaultMaterial } from "@/widgets/Materials/MeshDefaultMaterial"
import { BirdGeometry } from "./BirdGeometry"

export class Birds implements IGameObject {
    private context: GameContext | null = null
    private mesh: InstancedMesh | null = null
    private modelGroup: Group

    // --- 설정 값 ---
    private WIDTH = 16 // 32*32 = 1024마리
    private COUNT = this.WIDTH * this.WIDTH

    // 비행 구역 (직육면체)
    private LIMIT_X = 1000.0
    private LIMIT_Z = 1000.0
    private MIN_Y = 15.0 // 바닥
    private MAX_Y = 120.0 // 천장

    private computeVelocity: any
    private computePosition: any
    private positionBuffer: StorageInstancedBufferAttribute | null = null
    private velocityBuffer: StorageInstancedBufferAttribute | null = null

    private timeUniform = uniform(0)
    private deltaUniform = uniform(0)
    private predatorUniform = uniform(new Vector3())

    private separationDist = uniform(20.0)
    private alignmentDist = uniform(20.0)
    private cohesionDist = uniform(20.0)
    private freedomFactor = uniform(0.75)
    private limitRadius = uniform(100.0)

    constructor(private position: Vector3 = new Vector3(0, 0, 0)) {
        this.modelGroup = new Group()
        this.modelGroup.position.copy(this.position)
    }

    async initialize(context: GameContext): Promise<void> {
        this.context = context
        this.initBuffers()
        this.initComputeLogic()
        this.initMesh()
    }

    // 초기화: 새들을 맵 전체에 흩뿌리기
    private initBuffers() {
        const positionArray = new Float32Array(this.COUNT * 3)
        const velocityArray = new Float32Array(this.COUNT * 3)

        for (let i = 0; i < this.COUNT; i++) {
            const i3 = i * 3
            // X, Z는 넓게 분포
            positionArray[i3 + 0] = (Math.random() - 0.5) * (this.LIMIT_X * 1.8)
            // Y는 비행 가능 구역 내 분포
            positionArray[i3 + 1] =
                this.MIN_Y + Math.random() * (this.MAX_Y - this.MIN_Y)
            positionArray[i3 + 2] = (Math.random() - 0.5) * (this.LIMIT_Z * 1.8)

            // 속도 랜덤
            velocityArray[i3 + 0] = (Math.random() - 0.5) * 10
            velocityArray[i3 + 1] = (Math.random() - 0.5) * 10
            velocityArray[i3 + 2] = (Math.random() - 0.5) * 10
        }

        this.positionBuffer = new StorageInstancedBufferAttribute(
            positionArray,
            3,
        )
        this.velocityBuffer = new StorageInstancedBufferAttribute(
            velocityArray,
            3,
        )
    }

    // 물리 엔진: 관성, 경계 처리, Boids 알고리즘
    private initComputeLogic() {
        if (!this.positionBuffer || !this.velocityBuffer) return

        const positionStorage = storage(this.positionBuffer, "vec3", this.COUNT)
        const velocityStorage = storage(this.velocityBuffer, "vec3", this.COUNT)

        const boidsLogic = Fn(() => {
            const currentPos = positionStorage.element(instanceIndex)
            const currentVel = velocityStorage.element(instanceIndex)

            const separation = vec3(0).toVar()
            const alignment = vec3(0).toVar()
            const cohesion = vec3(0).toVar()
            const countSep = float(0).toVar()
            const countAli = float(0).toVar()
            const countCoh = float(0).toVar()

            // Boids 이웃 검사 루프
            Loop({ start: 0, end: this.COUNT, type: "int" }, ({ i }) => {
                const index = int(i)
                If(index.notEqual(instanceIndex), () => {
                    const otherPos = positionStorage.element(index)
                    const otherVel = velocityStorage.element(index)
                    const dist = currentPos.distance(otherPos)

                    If(dist.greaterThan(0.0), () => {
                        // Separation: 가까우면 밀어냄
                        If(dist.lessThan(this.separationDist), () => {
                            const push = currentPos.sub(otherPos).normalize()
                            separation.addAssign(push.div(dist))
                            countSep.addAssign(1.0)
                        })
                        // Alignment: 비슷하게 이동
                        If(dist.lessThan(this.alignmentDist), () => {
                            alignment.addAssign(otherVel)
                            countAli.addAssign(1.0)
                        })
                        // Cohesion: 뭉침
                        If(dist.lessThan(this.cohesionDist), () => {
                            cohesion.addAssign(otherPos)
                            countCoh.addAssign(1.0)
                        })
                    })
                })
            })

            If(countSep.greaterThan(0.0), () => {
                /* separation sum 그대로 사용 */
            })
            If(countAli.greaterThan(0.0), () => {
                alignment.divAssign(countAli)
            })
            If(countCoh.greaterThan(0.0), () => {
                cohesion.divAssign(countCoh).subAssign(currentPos)
            })

            const force = separation
                .mul(3.0) // 충돌 방지 우선
                .add(alignment.mul(1.0))
                .add(cohesion.mul(1.0))
                .mul(this.freedomFactor)

            // Predator 회피
            const predatorDir = currentPos.sub(this.predatorUniform)
            const predatorDist = predatorDir.length()
            If(predatorDist.lessThan(this.limitRadius), () => {
                const repulse = predatorDir
                    .normalize()
                    .mul(this.limitRadius.sub(predatorDist).mul(4.0))
                currentVel.addAssign(repulse)
            })

            // --- Soft Boundary (부드러운 경계 처리) ---
            const limitX = float(this.LIMIT_X)
            const limitZ = float(this.LIMIT_Z)
            const minY = float(this.MIN_Y)
            const maxY = float(this.MAX_Y)
            const turnFactor = this.deltaUniform.mul(30.0)

            // 경계의 80% 지점부터 안쪽으로 회전 시작
            If(currentPos.x.greaterThan(limitX.mul(0.8)), () => {
                currentVel.x.subAssign(turnFactor)
            }).ElseIf(currentPos.x.lessThan(limitX.negate().mul(0.8)), () => {
                currentVel.x.addAssign(turnFactor)
            })

            If(currentPos.z.greaterThan(limitZ.mul(0.8)), () => {
                currentVel.z.subAssign(turnFactor)
            }).ElseIf(currentPos.z.lessThan(limitZ.negate().mul(0.8)), () => {
                currentVel.z.addAssign(turnFactor)
            })

            If(currentPos.y.greaterThan(maxY.mul(0.9)), () => {
                currentVel.y.subAssign(turnFactor)
            }).ElseIf(currentPos.y.lessThan(minY.mul(1.2)), () => {
                currentVel.y.addAssign(turnFactor.mul(2.0)) // 바닥은 강하게 회피
            })

            const targetVel = currentVel.add(force.mul(this.deltaUniform))

            // 속도 제한 (Min/Max)
            const speed = targetVel.length()
            const maxSpeed = float(10.0)
            const minSpeed = float(3.0)

            If(speed.greaterThan(maxSpeed), () => {
                targetVel.assign(targetVel.normalize().mul(maxSpeed))
            })
            If(speed.lessThan(minSpeed), () => {
                targetVel.assign(targetVel.normalize().mul(minSpeed))
            })

            // 현재 속도와 목표 속도를 보간하여 부드러운 회전 구현 (0.05~0.1 추천)
            const smoothedVel = mix(currentVel, targetVel, 0.08)
            velocityStorage.element(instanceIndex).assign(smoothedVel)
        })

        const updatePos = Fn(() => {
            const p = positionStorage.element(instanceIndex)
            const v = velocityStorage.element(instanceIndex)
            p.addAssign(v.mul(this.deltaUniform).mul(5.0)) // 이동 속도 계수
        })

        this.computeVelocity = boidsLogic().compute(this.COUNT)
        this.computePosition = updatePos().compute(this.COUNT)
    }

    // 렌더링: Banking, Flapping, Scaling
    private initMesh() {
        if (!this.context || !this.positionBuffer || !this.velocityBuffer)
            return

        const geometry = new BirdGeometry()
        const material = new MeshDefaultMaterial({
            colorNode: attribute("birdColor", "vec3") as any,
            side: DoubleSide,
            hasFog: true,
        })

        const posNode = storage(
            this.positionBuffer,
            "vec3",
            this.COUNT,
        ).element(instanceIndex)
        const velNode = storage(
            this.velocityBuffer,
            "vec3",
            this.COUNT,
        ).element(instanceIndex)

        const birdVertexAttr = attribute("birdVertex", "float")
        const time = this.timeUniform

        // Dynamic Flapping 속도가 빠를수록 날개짓을 빨리 함
        const speed = velNode.length()
        const wingSpeed = float(5.0).add(speed.mul(2.0))

        const phase = float(instanceIndex).mul(0.3) // 랜덤 위상
        const flapWave = sin(time.mul(wingSpeed).add(phase))
        const wingYOffset = flapWave.mul(4.0).mul(birdVertexAttr.step(0.5)) // 날개만 움직임

        // 날개짓이 적용된 로컬 Y 좌표
        const animatedLocalY = positionLocal.y.add(wingYOffset)

        // 좌우 선회 시 몸체 기울이기 (Roll)
        // 속도의 X 성분(좌우)에 따라 회전각 결정
        const bankAmount = velNode.x.mul(-0.5)
        const clampedBank = mix(0.0, bankAmount, 0.5) // 과도한 회전 방지

        const cosB = cos(clampedBank)
        const sinB = sin(clampedBank)

        // Z축 회전 행렬 적용 (Local Space)
        // x' = x*cos - y*sin
        // y' = x*sin + y*cos
        const bankedX = positionLocal.x.mul(cosB).sub(animatedLocalY.mul(sinB))
        const bankedY = positionLocal.x.mul(sinB).add(animatedLocalY.mul(cosB))

        // 속도 방향 보기 (LookAt)
        const forward = normalize(velNode)
        const up = vec3(0, 1, 0)
        const right = normalize(cross(forward, up))
        const realUp = cross(right, forward)

        // 최종 Vertex 계산: WorldPos + LookAtMatrix * BankedLocalPos
        const rotatedLocalPos = right
            .mul(bankedX)
            .add(realUp.mul(bankedY))
            .add(forward.mul(positionLocal.z))

        // Random Scale: 새마다 크기 다양화
        const randSeed = sin(float(instanceIndex).mul(12.9898)).fract()
        const randomScale = mix(0.7, 1.3, randSeed)

        const finalPos = posNode.add(rotatedLocalPos.mul(randomScale))

        material.positionNode = finalPos

        // InstancedMesh 생성
        this.mesh = new InstancedMesh(geometry, material, this.COUNT)
        this.mesh.castShadow = true
        this.mesh.receiveShadow = true
        this.mesh.frustumCulled = false

        this.modelGroup.add(this.mesh)
        this.modelGroup.scale.setScalar(0.075) // 전체 모델 크기
        this.context.scene.add(this.modelGroup)
    }

    public update(deltaTime: number): void {
        if (!this.context || !this.mesh) return

        const delta = deltaTime
        this.timeUniform.value = this.context.time.elapsed * 0.001
        this.deltaUniform.value = delta

        const ship = this.context.scene.children.find(
            (c) => c.name === "SpaceShip",
        )
        if (ship) {
            this.predatorUniform.value.copy(ship.position)
        }

        this.context.rendering.renderer.compute(this.computeVelocity)
        this.context.rendering.renderer.compute(this.computePosition)
    }

    public dispose(): void {
        if (this.mesh) {
            this.context?.scene.remove(this.modelGroup)
            this.mesh.geometry.dispose()
        }
    }
}

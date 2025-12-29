import {
	cross,
	Fn,
	float,
	If,
	instanceIndex,
	int,
	Loop,
	normalize,
	positionLocal,
	storage,
	uniform,
	vec3,
} from "three/tsl"
import * as THREE from "three/webgpu"
import type { GameContext, IGameObject } from "@/core/GameContext"
import { BirdGeometry } from "./BirdGeometry"

export class Birds implements IGameObject {
	private context: GameContext | null = null
	private mesh: THREE.Mesh | null = null
	private modelGroup: THREE.Group

	// --- 설정 값 ---
	private WIDTH = 24
	private COUNT = 24 * 24
	private BOUNDS = 1000

	// --- TSL Compute Nodes ---
	private computeVelocity: any
	private computePosition: any

	// --- Storage Buffers ---
	private positionBuffer: THREE.StorageInstancedBufferAttribute | null = null
	private velocityBuffer: THREE.StorageInstancedBufferAttribute | null = null

	// --- Uniforms ---
	private timeUniform = uniform(0)
	private deltaUniform = uniform(0)
	private predatorUniform = uniform(new THREE.Vector3())

	// Boids 파라미터 (모두 사용하도록 수정됨)
	private separationDist = uniform(20.0)
	private alignmentDist = uniform(20.0)
	private cohesionDist = uniform(20.0)
	private freedomFactor = uniform(0.75)
	private limitRadius = uniform(100.0)

	constructor(private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
		this.modelGroup = new THREE.Group()
		this.modelGroup.position.copy(this.position)
	}

	async initialize(context: GameContext): Promise<void> {
		this.context = context
		this.initBuffers()
		this.initComputeLogic()
		this.initMesh()
	}

	private initBuffers() {
		const positionArray = new Float32Array(this.COUNT * 3)
		const velocityArray = new Float32Array(this.COUNT * 3)

		const SPAWN_RANGE = 90.0
		const FLIGHT_RANGE = 20.0
		const FLOOR_LEVEL = 5.0

		for (let i = 0; i < this.COUNT; i++) {
			const i3 = i * 3
			positionArray[i3 + 0] = (Math.random() - 0.5) * SPAWN_RANGE
			positionArray[i3 + 1] = Math.random() * FLIGHT_RANGE + FLOOR_LEVEL
			positionArray[i3 + 2] = (Math.random() - 0.5) * SPAWN_RANGE

			velocityArray[i3 + 0] = (Math.random() - 0.5) * 10
			velocityArray[i3 + 1] = (Math.random() - 0.5) * 10
			velocityArray[i3 + 2] = (Math.random() - 0.5) * 10
		}

		this.positionBuffer = new THREE.StorageInstancedBufferAttribute(
			positionArray,
			3,
		)
		this.velocityBuffer = new THREE.StorageInstancedBufferAttribute(
			velocityArray,
			3,
		)
	}

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

			// 각 힘에 대한 카운트 (이웃 개수)
			const countSep = float(0).toVar()
			const countAli = float(0).toVar()
			const countCoh = float(0).toVar()

			Loop({ start: 0, end: this.COUNT, type: "int" }, ({ i }) => {
				const index = int(i) // 명시적 형변환으로 타입 에러 방지

				If(index.notEqual(instanceIndex), () => {
					const otherPos = positionStorage.element(index)
					const otherVel = velocityStorage.element(index)
					const dist = currentPos.distance(otherPos)

					If(dist.greaterThan(0.0), () => {
						// [수정] 각 거리에 따라 힘을 적용 (Unused Variables 해결)

						// 1. Separation
						If(dist.lessThan(this.separationDist), () => {
							const push = currentPos.sub(otherPos).normalize()
							separation.addAssign(push.div(dist))
							countSep.addAssign(1.0)
						})

						// 2. Alignment
						If(dist.lessThan(this.alignmentDist), () => {
							alignment.addAssign(otherVel)
							countAli.addAssign(1.0)
						})

						// 3. Cohesion
						If(dist.lessThan(this.cohesionDist), () => {
							cohesion.addAssign(otherPos)
							countCoh.addAssign(1.0)
						})
					})
				})
			})

			// 평균 계산 및 힘 적용
			If(countSep.greaterThan(0.0), () => {
				// separation은 이미 거리로 나누었으므로 그대로 사용하거나 스케일링
			})

			If(countAli.greaterThan(0.0), () => {
				alignment.divAssign(countAli) // 평균 속도
			})

			If(countCoh.greaterThan(0.0), () => {
				cohesion.divAssign(countCoh).subAssign(currentPos) // 중심점 - 내 위치
			})

			const force = separation
				.mul(2.0)
				.add(alignment.mul(1.0))
				.add(cohesion.mul(0.5))
				.mul(this.freedomFactor)

			// Predator (포식자)
			const predatorDir = currentPos.sub(this.predatorUniform)
			const predatorDist = predatorDir.length()
			If(predatorDist.lessThan(this.limitRadius), () => {
				const repulse = predatorDir
					.normalize()
					.mul(this.limitRadius.sub(predatorDist).mul(2.0))
				currentVel.addAssign(repulse)
			})

			// 물리 업데이트
			currentVel.addAssign(force.mul(this.deltaUniform))

			// 속도 제한
			const speed = currentVel.length()
			const maxSpeed = float(4.0)
			If(speed.greaterThan(maxSpeed), () => {
				currentVel.assign(currentVel.normalize().mul(maxSpeed))
			})

			// 경계 처리
			const distFromCenter = currentPos.length()
			If(distFromCenter.greaterThan(this.BOUNDS), () => {
				currentVel.subAssign(
					currentPos.normalize().mul(this.deltaUniform).mul(10.0),
				)
			})

			velocityStorage.element(instanceIndex).assign(currentVel)
		})

		const updatePos = Fn(() => {
			const p = positionStorage.element(instanceIndex)
			const v = velocityStorage.element(instanceIndex)
			// 속도 기반 위치 이동
			p.addAssign(v.mul(this.deltaUniform).mul(5.0))
		})

		this.computeVelocity = boidsLogic().compute(this.COUNT)
		this.computePosition = updatePos().compute(this.COUNT)
	}

	private initMesh() {
		if (!this.context || !this.positionBuffer || !this.velocityBuffer)
			return

		const geometry = new BirdGeometry(this.WIDTH, this.COUNT)

		const material = new THREE.MeshStandardNodeMaterial({
			color: 0xff2200,
			roughness: 0.5,
			metalness: 0.5,
			side: THREE.DoubleSide,
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

		// [중요] mat3 에러 해결을 위한 "기저 벡터 직접 변환" 방식
		// 행렬을 만들지 않고 로컬 좌표(positionLocal)를 기저 벡터(Right, Up, Forward)에 투영하여 회전시킵니다.
		// 이는 mat3(vec3, vec3, vec3) * vec3 연산과 수학적으로 동일하며, 타입 에러가 없습니다.

		const forward = normalize(velNode)
		const up = vec3(0, 1, 0)
		const right = normalize(cross(forward, up))
		const realUp = cross(right, forward)

		// Final Position = WorldPos + (Right * Local.x + RealUp * Local.y + Forward * Local.z)
		const rotatedLocalPos = right
			.mul(positionLocal.x)
			.add(realUp.mul(positionLocal.y))
			.add(forward.mul(positionLocal.z))

		const finalPos = posNode.add(rotatedLocalPos)

		material.positionNode = finalPos

		this.mesh = new THREE.Mesh(geometry, material)
		this.mesh.castShadow = true
		this.mesh.receiveShadow = true
		this.mesh.frustumCulled = false

		this.modelGroup.add(this.mesh)
		this.modelGroup.scale.setScalar(0.09)
		this.context.scene.add(this.modelGroup)
	}

	public update(deltaTime: number): void {
		if (!this.context || !this.mesh) return

		const delta = deltaTime * 0.001
		this.timeUniform.value = this.context.time.elapsed * 0.001
		this.deltaUniform.value = delta

		const ship = this.context.scene.children.find(
			(c) => c.name === "SpaceShip",
		)
		if (ship) {
			this.predatorUniform.value.copy(ship.position)
		}

		this.context.renderer.compute(this.computeVelocity)
		this.context.renderer.compute(this.computePosition)
	}

	public dispose(): void {
		if (this.mesh) {
			this.context?.scene.remove(this.modelGroup)
			this.mesh.geometry.dispose()
			;(this.mesh.material as THREE.Material).dispose()
		}
	}
}

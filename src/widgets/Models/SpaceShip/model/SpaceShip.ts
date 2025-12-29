import * as RAPIER from "@dimforge/rapier3d-compat"
import gsap from "gsap" // Import GSAP
import * as THREE from "three"
import type { FlightActionMapper } from "@/Inputs/mappers/FlightActionMapper"
import type { FlightActions } from "@/Inputs/types"
import { FlightController } from "@/widgets/controllers/FlightController"
import { TweakPane } from "@/widgets/TweakPane"
import { BaseModel } from "../../BaseModel"
import { EngineFlame } from "../../EngineFlame"
import { SpaceShipCameraDebugModule } from "../debug/SpaceShip.CameraDebug"
// Debug Modules
import { SpaceShipPositionDebugModule } from "../debug/SpaceShip.PositionDebug"
import { SpaceShipVisualDebugModule } from "../debug/SpaceShip.VisualDebug"

export class SpaceShip extends BaseModel {
	shipPivot: THREE.Object3D | null = null // 물리 엔진과 연결된 메인 컨테이너
	private visualPivot: THREE.Object3D | null = null // 시각적 효과용 중간 컨테이너
	private flightController: FlightController
	private debugMode: boolean = false
	private engineFlames: EngineFlame[] = [] // Array for multiple flames

	// ⚡ 불꽃 성장 설정
	private currentFlameLength: number = 0.1
	private maxFlameLength: number = 1.5
	private flameGrowthSpeed: number = 1.0 // 초당 성장 속도
	private flameShrinkSpeed: number = 1.2 // 초당 감소 속도

	// 🎯 뱅킹(Banking) 효과 설정 - 간단한 지수 감쇠 방식
	private maxBankingAngle: number = Math.PI / 4.5 // 40도 (라디안) - 적절한 기울기
	private currentBankingAngle: number = 0 // 현재 기울기 각도

	// 🌊 간단한 보간 설정
	private bankingLerpSpeed: number = 6.0 // 기울기 변화 속도 (부드러운 보간)

	private axesHelper: THREE.AxesHelper | null = null
	private rollAxisHelper: THREE.ArrowHelper | null = null
	private yawAxisHelper: THREE.ArrowHelper | null = null
	private pitchAxisHelper: THREE.ArrowHelper | null = null
	private showAxes: boolean = true

	private positionDebugModule: SpaceShipPositionDebugModule
	private cameraDebugModule: SpaceShipCameraDebugModule
	private visualDebugModule: SpaceShipVisualDebugModule

	constructor() {
		super("spaceshipModel", new THREE.Vector3(0, 0.75, 0))

		const positions = [
			new THREE.Vector3(-1.1, -0.15, -0.15),
			new THREE.Vector3(-1.1, -0.15, 0.175),
		]

		positions.forEach((pos) => {
			const flame = new EngineFlame(pos)
			flame.modelGroup.rotateZ(1.55) // Apply the rotation here
			this.engineFlames.push(flame)
		})

		this.flightController = new FlightController()

		this.positionDebugModule = new SpaceShipPositionDebugModule(() => ({
			rigidBody: this.rigidBody,
			shipPivot: this.shipPivot,
			mesh: this.mesh,
		}))

		this.cameraDebugModule = new SpaceShipCameraDebugModule()

		this.visualDebugModule = new SpaceShipVisualDebugModule(() => ({
			showAxes: this.showAxes,
			axesHelper: this.axesHelper,
			rollAxisHelper: this.rollAxisHelper,
			yawAxisHelper: this.yawAxisHelper,
			pitchAxisHelper: this.pitchAxisHelper,
			toggleAxesVisibility: () => {
				this.showAxes = !this.showAxes
				this.toggleAxesVisibility()
			},
		}))

		this.setupTweakPane()
	}

	/**
	 * BaseModel의 setupModelStructure를 오버라이드하여
	 * 물리 엔진과 시각적 효과를 분리한 계층 구조 구현
	 * shipPivot(물리) -> visualPivot(시각적 기울기) -> mesh(모델)
	 */
	protected setupModelStructure(clonedModel: THREE.Object3D): void {
		// 🏗️ 물리 엔진과 연결된 메인 컨테이너
		this.shipPivot = new THREE.Object3D()
		this.shipPivot.name = "ShipPivot"

		// 🎨 시각적 효과용 중간 컨테이너 (뱅킹 효과 담당)
		this.visualPivot = new THREE.Object3D()
		this.visualPivot.name = "VisualPivot"

		// 📦 실제 3D 모델
		this.mesh = clonedModel

		// 🎯 모델 중심점 맞추기
		const box = new THREE.Box3().setFromObject(this.mesh)
		const centerOffset = box.getCenter(new THREE.Vector3())

		this.mesh.position.set(
			-centerOffset.x,
			-centerOffset.y,
			-centerOffset.z,
		)

		// Enable shadows
		this.mesh.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.castShadow = true
				child.receiveShadow = true
			}
		})

		// 🏗️ 계층 구조 구성: shipPivot -> visualPivot -> mesh
		this.visualPivot.add(this.mesh)
		this.engineFlames.forEach((flame) => {
			if (!this.visualPivot) {
				return
			}
			this.visualPivot.add(flame.modelGroup)
		})

		this.shipPivot.add(this.visualPivot)
		this.shipPivot.rotateY(Math.PI / 2)

		// 씬에 추가
		if (this.context) {
			this.context.scene.add(this.shipPivot)
		}
	}

	/**
	 * 🏗️ 물리 엔진 설정
	 * BaseModel의 setupPhysics를 오버라이드
	 */
	protected async setupPhysics(): Promise<void> {
		if (!this.rigidBody && this.context?.physics && this.mesh) {
			this.createPhysicsBody(this.context.physics)
		}
	}

	private createPhysicsBody(physics: any): void {
		if (!this.shipPivot || !this.mesh) return

		const bounds = this.getModelBounds()
		const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(this.position.x, this.position.y, this.position.z)
			.setRotation({
				x: this.shipPivot.quaternion.x,
				y: this.shipPivot.quaternion.y,
				z: this.shipPivot.quaternion.z,
				w: this.shipPivot.quaternion.w,
			})
			.setLinearDamping(10.5)
			.setAngularDamping(13.5)

		this.rigidBody = physics.world.createRigidBody(rigidBodyDesc)
		if (this.rigidBody) {
			this.rigidBody.setEnabledRotations(false, true, false, true)
		}

		const shipColliderDesc = RAPIER.ColliderDesc.cuboid(
			bounds.size.x / 2,
			bounds.size.y / 2,
			bounds.size.z / 2,
		)

		shipColliderDesc.setTranslation(0, 0, 0)

		shipColliderDesc.setMass(5.0)
		shipColliderDesc.setRestitution(0.1)
		shipColliderDesc.setFriction(0.5)

		physics.world.createCollider(shipColliderDesc, this.rigidBody)
	}

	/**
	 * 🎯 모델 로드 완료 후 추가 설정
	 * BaseModel의 onModelLoaded를 오버라이드
	 */
	protected async onModelLoaded(): Promise<void> {
		if (!this.context) return

		// Initialize EngineFlames
		for (const flame of this.engineFlames) {
			await flame.initialize(this.context)
			// Ensure attached to visualPivot (safety check against scene add)
			this.visualPivot?.add(flame.modelGroup)
		}

		this.createFlightAxes()
		this.setupInputListeners()
	}

	private setupTweakPane() {
		const urlParams = new URLSearchParams(window.location.search)
		const debugParam = urlParams.get("debug")
		this.debugMode = debugParam === "spaceship"
		if (!this.debugMode) {
			return
		}

		const pane = TweakPane.getInstance()
		const f = pane.addFolder({
			title: "SpaceShip Debug Controls",
			expanded: true,
		})

		// 각 디버그 모듈에 위임
		this.positionDebugModule.setupDebugControls(f)
		this.cameraDebugModule.setupDebugControls(f)
		this.visualDebugModule.setupDebugControls(f)
	}

	private setupInputListeners(): void {
		if (!this.context) return

		// WASD 입력 시: 카메라 추적 모드 활성화, OrbitControls 비활성화
		this.context.inputManager.on(
			"action.flight",
			(actions: FlightActions) => {
				this.handleFlightInput(actions)
				if (!this.context) {
					return
				}

				// 입력값이 있으면(즉, WASD 등 이동) 추적 모드로 전환
				const hasInput =
					Math.abs(actions.movement.x) > 0.01 ||
					Math.abs(actions.movement.y) > 0.01
				if (hasInput) {
					this.context.camera.setFollowTargetObject(
						this.shipPivot,
						new THREE.Vector3(8, 40, 10),
						0.12,
					)
					if (this.context.camera.orbitControls) {
						this.context.camera.orbitControls.enabled = false
					}
				}
			},
		)

		// 마우스 클릭/드래그 시: OrbitControls 활성화, 카메라 추적 모드 해제
		const domElement = this.context.renderer.domElement
		// 좌클릭 또는 미들클릭 시 OrbitControls 활성화
		domElement.addEventListener(
			"pointerdown",
			(event: PointerEvent) => {
				if (!this.context) {
					return
				}

				if (event.button === 0 || event.button === 1) {
					if (this.context.camera.orbitControls) {
						if (!this.shipPivot) {
							return
						}

						const targetPos = this.shipPivot.getWorldPosition(
							new THREE.Vector3(),
						)
						this.context.camera.orbitControls.target.copy(targetPos)
						this.context.camera.orbitControls.update()
						this.context.camera.orbitControls.enabled = true
					}
					this.context.camera.setFollowTargetObject(null)
				}
			},
			{ capture: true },
		)
	}

	private handleFlightInput(actions: FlightActions): void {
		const hasInput =
			Math.abs(actions.movement.x) > 0.01 ||
			Math.abs(actions.movement.y) > 0.01

		if (hasInput && this.context) {
			// ServiceRegistry를 통해 Game 인스턴스에 접근
			// const game = ServiceRegistry.getInstance().get<any>('game');
			// if (game && typeof game.enableOrbitController === 'function') {
			//   game.enableOrbitController(false);
			// }
		}

		// 🎯 뱅킹 효과 처리: A/D 키 입력에 따른 롤 기울기
		this.updateBankingEffect(actions.movement.x)
	}

	update(deltaTime: number) {
		if (this.rigidBody && this.shipPivot && this.mesh && this.context) {
			const flightMapper =
				this.context.inputManager.actionMappers.get("flight")
			if (flightMapper) {
				const currentActions = (
					flightMapper as FlightActionMapper
				).getCurrentActions()
				this.flightController.updateMovementInput(currentActions)
				this.flightController.handleMovement(this.rigidBody)
			}

			const position = this.rigidBody.translation()
			const rotation = this.rigidBody.rotation()

			this.shipPivot.position.set(position.x, position.y, position.z)
			this.shipPivot.quaternion.set(
				rotation.x,
				rotation.y,
				rotation.z,
				rotation.w,
			)

			// const game = ServiceRegistry.getInstance().get<any>('game');
			// if (game.orbitControls?.enabled) {
			//   game.orbitControls.target.set(position.x, position.y, position.z);
			// }

			// 🎨 시각적 뱅킹 효과 업데이트 (물리 엔진과 독립적)
			// this.updateBankingAnimation(deltaTime); // GSAP로 대체됨

			this.updateFlightAxes()
			this.updateCameraTracking()

			// 개선된 속도 제한 로직 디버깅을 위한 로그 (디버그 모드에서만)
			if (this.debugMode) {
				this.logImprovedSpeedLimits()
			}

			// Update Engine Flame based on thrust
			const thrustLevel = this.flightController.getSmoothedThrust()
			const absThrust = Math.abs(thrustLevel)

			// 조작 시간에 비례하여 불꽃 길이 성장/감소
			if (absThrust > 0.05) {
				this.currentFlameLength = Math.min(
					this.maxFlameLength,
					this.currentFlameLength + this.flameGrowthSpeed * deltaTime,
				)
			} else {
				this.currentFlameLength = Math.max(
					0.1,
					this.currentFlameLength - this.flameShrinkSpeed * deltaTime,
				)
			}

			this.engineFlames.forEach((flame) => {
				flame.setThrust(absThrust)
				flame.setFlameLength(this.currentFlameLength) // 성장한 길이 적용
				flame.update(deltaTime)
			})
		}
	}

	/**
	 * 🎯 항공기 축 시각화 생성
	 * Roll (X축 - 빨강), Yaw (Y축 - 초록), Pitch (Z축 - 파랑)
	 * 축들을 visualPivot에 추가하여 기울기 효과와 함께 회전
	 */
	private createFlightAxes(): void {
		if (!this.visualPivot) return

		// 기본 좌표계 축 (작은 크기)
		this.axesHelper = new THREE.AxesHelper(0.5)
		this.visualPivot.add(this.axesHelper)

		// Roll 축 (X축 기준 회전) - 빨간색 화살표
		const rollDirection = new THREE.Vector3(1, 0, 0) // X축
		this.rollAxisHelper = new THREE.ArrowHelper(
			rollDirection,
			new THREE.Vector3(0, 0, 0),
			1.5,
			0xff0000, // 빨간색
			0.3,
			0.2,
		)
		this.visualPivot.add(this.rollAxisHelper)

		// Yaw 축 (Y축 기준 회전) - 초록색 화살표
		const yawDirection = new THREE.Vector3(0, 1, 0) // Y축
		this.yawAxisHelper = new THREE.ArrowHelper(
			yawDirection,
			new THREE.Vector3(0, 0, 0),
			1.5,
			0x00ff00, // 초록색
			0.3,
			0.2,
		)
		this.visualPivot.add(this.yawAxisHelper)

		// Pitch 축 (Z축 기준 회전) - 파란색 화살표
		const pitchDirection = new THREE.Vector3(0, 0, 1) // Z축
		this.pitchAxisHelper = new THREE.ArrowHelper(
			pitchDirection,
			new THREE.Vector3(0, 0, 0),
			1.5,
			0x0000ff, // 파란색
			0.3,
			0.2,
		)
		this.visualPivot.add(this.pitchAxisHelper)
	}

	private updateFlightAxes(): void {
		// 축들은 shipPivot의 자식이므로 자동으로 회전이 적용됩니다.
		// 추가적인 업데이트가 필요한 경우 여기에 구현
	}

	private updateCameraTracking(): void {
		// Camera의 followTargetObject 기능을 활용하여 카메라가 우주선을 추적하도록 설정
		if (!this.context || !this.shipPivot) return

		// Camera에 추적 대상 지정 (offset은 기존 값 활용, 필요시 조정 가능)
		this.context.camera.setFollowTargetObject(
			this.shipPivot,
			new THREE.Vector3(8, 40, 10), // 기존 offset 값
			0.12, // 기본 easing 값, 필요시 조정 가능
		)
	}

	private toggleAxesVisibility(): void {
		if (
			!this.axesHelper ||
			!this.rollAxisHelper ||
			!this.yawAxisHelper ||
			!this.pitchAxisHelper
		)
			return

		this.axesHelper.visible = this.showAxes
		this.rollAxisHelper.visible = this.showAxes
		this.yawAxisHelper.visible = this.showAxes
		this.pitchAxisHelper.visible = this.showAxes
	}

	/**
	 * 🎯 뱅킹 효과 처리: A/D 키 입력에 따른 목표 기울기 설정
	 * @param rollInput A/D 키 입력값 (-1: A키/왼쪽, 1: D키/오른쪽)
	 */
	private updateBankingEffect(rollInput: number): void {
		if (!this.visualPivot) return

		// 입력이 없으면 0도로 복귀, 있으면 입력 방향에 따라 기울기 설정
		let targetAngle =
			Math.abs(rollInput) > 0.01 ? rollInput * this.maxBankingAngle : 0

		// 🛡️ 안전장치: 목표 각도 제한
		targetAngle = Math.max(
			-this.maxBankingAngle,
			Math.min(this.maxBankingAngle, targetAngle),
		)

		// GSAP를 사용하여 부드러운 회전 애니메이션 적용
		// 현재 회전값에서 목표 회전값으로 eosing을 적용하여 이동
		gsap.to(this.visualPivot.rotation, {
			x: targetAngle,
			duration: 0.8, // 반응 속도 조절 (초 단위)
			ease: "power2.out", // 부드러운 감속 효과
			overwrite: true, // 이전 애니메이션을 덮어쓰고 새로운 목표로 즉시 전환
		})
	}

	setMaxBankingAngle(angleDegrees: number): void {
		this.maxBankingAngle = THREE.MathUtils.degToRad(
			Math.max(0, Math.min(90, angleDegrees)),
		)
	}

	getMaxBankingAngle(): number {
		return THREE.MathUtils.radToDeg(this.maxBankingAngle)
	}

	setBankingSpeed(speed: number): void {
		this.bankingLerpSpeed = Math.max(0.5, Math.min(20, speed))
	}

	getBankingSpeed(): number {
		return this.bankingLerpSpeed
	}

	getCurrentBankingAngle(): number {
		return THREE.MathUtils.radToDeg(this.currentBankingAngle)
	}

	private logImprovedSpeedLimits(): void {
		if (!this.rigidBody) return

		// 정기적으로 속도 정보 출력 (성능 고려하여 랜덤 샘플링)
		// if (Math.random() < 0.01) {
		//   // 1% 확률로 출력
		//   const linvel = this.rigidBody.linvel();
		//   const angvel = this.rigidBody.angvel();

		//   console.log("🚀 우주선 속도 상태:", {
		//     선속도: `${linvel.x.toFixed(2)}, ${linvel.y.toFixed(
		//       2
		//     )}, ${linvel.z.toFixed(2)}`,
		//     각속도: `${angvel.x.toFixed(2)}, ${angvel.y.toFixed(
		//       2
		//     )}, ${angvel.z.toFixed(2)}`,
		//     전진속도: `${linvel.z.toFixed(2)} m/s`,
		//     Y축회전: `${angvel.y.toFixed(2)} rad/s`,
		//   });
		// }
	}
}

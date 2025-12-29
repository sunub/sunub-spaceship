import * as RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three/webgpu"
import type { GameContext, IGameObject } from "../core/GameContext"
import { GridMaterial } from "./Materials/GridMaterial"
import { Grass } from "./Models/Grass"
import { TweakPane } from "./TweakPane"

export class Floor extends THREE.Mesh implements IGameObject
{
	private context: GameContext | null = null
	private size: number = 200 // Increased size to match Game.ts
	private gridMaterial: GridMaterial
	private gridOptions: {
		gridDensity: number
		gridThickness: number
	} = {
			gridDensity: 1.0,
			gridThickness: 0.01,
		}

	private grass: Grass

	constructor(size: number = 200)
	{
		super()
		this.receiveShadow = true
		this.castShadow = true
		this.size = size

		// GridMaterial 생성
		this.gridMaterial = new GridMaterial({
			gridDensity: this.gridOptions.gridDensity,
			gridThickness: this.gridOptions.gridThickness,
		})

		// Three.js 메쉬 설정
		this.geometry = new THREE.PlaneGeometry(this.size, this.size)
		this.material = this.gridMaterial
		this.rotation.x = -Math.PI / 2 // 바닥이 되도록 회전
		this.frustumCulled = false
		this.receiveShadow = true

		// Grass 초기화 (아직 씬에 추가 안됨)
		this.grass = new Grass({
			count: 1000000, // Increased to 1,000,000 for full coverage
			width: 0.15, // Increased from 0.15 for better coverage
			height: 0.7, // Reduced from 1.2 to be shorter than SpaceShip (Y=0.75)
			patchSize: 3.0, // Increased from 1.5 to overlap patches (grid step is 2.0)
			areaSize: this.size,
		})
	}

	private addGrassOnTheScene(context: GameContext)
	{
		// Grass 씬에 추가
		if (this.grass.mesh)
		{
			context.scene.add(this.grass.mesh)
		}

		// 초기 풀 배치 (예제 패턴)
		this.plantInitialGrass()
	}

	async initialize(context: GameContext)
	{
		this.context = context
		this.setUpPhysics()
		this.setUpTweakPane()

		// 씬에 자동으로 추가
		context.scene.add(this)
		this.addGrassOnTheScene(context)
	}

	update(deltaTime: number)
	{
		// if(!this.context || !this.context.camera) {
		//   return;
		// }

		// this.position.set(
		//   this.context.camera.instance.position.x,
		//   0,
		//   this.context.camera.instance.position.z
		// );

		// Find Spaceship pivot to track position for grass interaction
		let playerPos: THREE.Vector3 | undefined
		if (this.context)
		{
			// Try to find the ship pivot by name (as defined in SpaceShip.ts)
			const ship = this.context.scene.getObjectByName("ShipPivot")
			if (ship)
			{
				playerPos = ship.position
			}
		}

		// Grass 애니메이션 업데이트 (Player Position 전달)
		if (this.grass)
		{
			this.grass.update(deltaTime, playerPos)
		}
	}

	private plantInitialGrass()
	{
		const locations: { x: number; z: number }[] = []
		const halfSize = this.size / 2

		// Massive budget: 1,000,000 grass blades.
		// Use 100 blades per patch for maximum density.
		// 1,000,000 / 100 = 10,000 patches.
		// sqrt(10,000) = 100.
		// 200 / 100 = 2.0 units step size.

		const densityPerPatch = 100
		const patchCountSide = Math.floor(
			Math.sqrt(this.grass.params.count / densityPerPatch),
		)
		const step = this.size / patchCountSide

		for (let i = 0; i < patchCountSide; i++)
		{
			for (let j = 0; j < patchCountSide; j++)
			{
				const baseX = -halfSize + i * step + step / 2
				const baseZ = -halfSize + j * step + step / 2

				// Jitter within the cell to eliminate grid patterns
				const jitterX = (Math.random() - 0.5) * step * 0.95
				const jitterZ = (Math.random() - 0.5) * step * 0.95

				locations.push({
					x: baseX + jitterX,
					z: baseZ + jitterZ,
				})
			}
		}

		this.grass.plantAtPositions(locations, densityPerPatch)
	}

	private setUpPhysics()
	{
		if (!this.context) return

		// RigidBody 생성 설명자(Descriptor)를 만듭니다.
		// 'fixed' 타입은 중력의 영향을 받지 않고 움직이지 않는 고정된 객체를 의미합니다.
		const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()

		// Three.js 메쉬의 위치를 물리 객체에 설정합니다.
		// 이 부분이 물리 엔진 세계에서의 박스 모델의 위치와 실제 모델이 렌더되는 세계의 위치를 일치시키는 역할을 합니다.
		// 이 부분을 제대로 설정하지 않을 경우 물리 충돌이 올바르게 작동하지 않을 수 있습니다.
		rigidBodyDesc.setTranslation(
			this.position.x,
			this.position.y,
			this.position.z,
		)

		// 물리 세계(world)에 RigidBody를 생성합니다.
		// 물리 엔진을 구현할 때 물리엔진의 세계와 렌더링 엔진의 세계가 일치하도록 하는 것이 매우 중요합니다.
		// 여기서는 GameContext를 통해 Physics 서비스에 접근하여 물리 세계에 바닥을 추가합니다.
		// 물리 엔진의 세계에 추가된 객체는 물리 시뮬레이션에 참여하게 됩니다.
		// 바닥은 고정된 객체이므로 다른 동적 객체들과 충돌할 수 있습니다.
		// 예를 들어, 우주선이 바닥과 충돌하면 물리 엔진이 이를 감지하고 적절한 반응을 계산합니다.
		const rigidBody =
			this.context.physics.world.createRigidBody(rigidBodyDesc)

		// Collider 생성 설명자(Descriptor)를 만듭니다.
		// Cuboid(직육면체, hx, hy, hz) 형태를 사용합니다. RAPIER는 '반쪽 길이(half-extents)'를 인자로 받습니다.
		// 바닥이므로 y축 두께는 매우 얇게 설정합니다.
		const colliderDesc = RAPIER.ColliderDesc.cuboid(
			this.size / 2.0,
			0.1,
			this.size / 2.0,
		)

		// 물리 세계에 Collider를 생성하고 위에서 만든 RigidBody에 붙여줍니다.
		this.context.physics.world.createCollider(colliderDesc, rigidBody)
	}

	private setUpTweakPane()
	{
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
		}).on("change", (ev: any) =>
		{
			this.gridMaterial.gridDensity = ev.value
		})

		f.addBinding(this.gridOptions, "gridThickness", {
			min: 0.001,
			max: 0.1,
			step: 0.001,
			label: "Grid Thickness",
		}).on("change", (ev: any) =>
		{
			this.gridMaterial.gridThickness = ev.value
		})

		// Grass Debug
		const gFolder = f.addFolder({ title: "Grass", expanded: false })
		gFolder
			.addBinding(this.grass.params, "width", { min: 0.01, max: 0.5 })
			.on("change", () =>
				this.grass.updateParams({ width: this.grass.params.width }),
			)
		gFolder
			.addBinding(this.grass.params, "height", { min: 0.1, max: 5.0 })
			.on("change", () =>
				this.grass.updateParams({ height: this.grass.params.height }),
			)
		// Interaction debug
		gFolder
			.addBinding({ interactRadius: 3.0 }, "interactRadius", {
				label: "Interact Radius",
				min: 0.1,
				max: 10.0,
			})
			.on("change", (ev: any) =>
				this.grass.updateInteractionRadius(ev.value),
			)

		gFolder.addBinding(this.grass.params, "count", {
			readonly: true,
			label: "Max Count",
		})
	}

	dispose()
	{
		if (this.context)
		{
			this.context.scene.remove(this)
			if (this.grass?.mesh)
			{
				this.context.scene.remove(this.grass.mesh)
			}
		}
	}
}

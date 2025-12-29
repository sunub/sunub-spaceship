import { Fn, float, mix, type ShaderNodeObject, uniform, vec4 } from "three/tsl"
import type { Node } from "three/webgpu"
import * as THREE from "three/webgpu"
import { Game } from "../../Game"
import gridNode from "./Shader/gridNode"
import getGridUV from "./Shader/gridVertex"

interface GridMaterialOptions
{
	gridDensity?: number
	gridThickness?: number
}

export class GridMaterial extends THREE.NodeMaterial
{
	private _uDensity: any
	private _uThickness: any
	private game: Game

	constructor(options: GridMaterialOptions = {})
	{
		super()
		this.game = Game.getInstance()
		const { gridDensity = 1.0, gridThickness = 0.01 } = options

		this._uDensity = uniform(gridDensity)
		this._uThickness = uniform(gridThickness)

		const worldUV = getGridUV()
		const gridColor = gridNode(worldUV, this._uDensity, this._uThickness)

		// Shadow Catcher Logic
		const catchedShadow = float(1).toVar()

			// Hook into internal Three.js shadow system
			; (this as any).receivedShadowNode = Fn(
				([shadow]: [ShaderNodeObject<Node>]) =>
				{
					// shadow.r: 빛을 받으면 1, 그림자면 0
					catchedShadow.assign(shadow.r)
					return float(1)
				},
			)

		this.outputNode = Fn(() =>
		{
			const finalColor = gridColor.toVar()

			// 그림자가 0이면(어두움) -> shadowMix가 커짐 -> shadowColor와 섞임
			// 그림자가 1이면(밝음) -> shadowMix가 0 -> 원래 색
			const shadowMix = float(1).sub(catchedShadow).mul(float(0.5)) // 0.5는 그림자 농도

			// [중요] 그리드 라인이 아닌 '빈 공간'에도 그림자가 그려져야 하므로
			// finalColor의 rgb에 그림자를 합성
			const shadedColor = mix(
				finalColor.rgb,
				this.game.lighting.shadowColor,
				shadowMix,
			)
			return vec4(shadedColor, finalColor.a)
		})()

		this.transparent = true
		this.depthWrite = false // 그리드 뒤의 물체가 보여야 한다면 false
		this.side = THREE.DoubleSide
	}

	// (선택 사항) TweakPane이 값을 '읽을' 수 있도록 getter/setter를 만들면
	// TweakPane 바인딩 시 .on('change') 대신 gridMaterial 자체를 바인딩할 수 있습니다.
	// 예: f.addBinding(this.gridMaterial, "gridDensity", ...)
	get gridDensity(): number
	{
		return this._uDensity.value
	}
	set gridDensity(value: number)
	{
		this._uDensity.value = value
	}

	get gridThickness(): number
	{
		return this._uThickness.value
	}
	set gridThickness(value: number)
	{
		this._uThickness.value = value
	}
}

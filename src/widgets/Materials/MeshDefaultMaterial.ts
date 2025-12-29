import
	{
		color,
		Fn,
		float,
		frontFacing,
		If,
		max,
		mix,
		normalWorld,
		positionWorld,
		type ShaderNodeObject,
		uniform,
		vec3,
		vec4,
	} from "three/tsl"
import type { Node } from "three/webgpu"
import * as THREE from "three/webgpu"
import { Game } from "../Game"

export interface MeshDefaultMaterialParameters
	extends THREE.MeshBasicNodeMaterialParameters
{
	hasCoreShadows?: boolean
	hasDropShadows?: boolean
	hasFog?: boolean
	hasLightBounce?: boolean
	colorNode?: ShaderNodeObject<Node>
	normalNode?: ShaderNodeObject<Node>
	shadowNode?: ShaderNodeObject<Node>
	alphaTest?: number
	shadowSide?: THREE.Side
}

// [핵심] Lambert가 아닌 Basic을 상속받아야 Custom Lighting과 충돌하지 않음
export class MeshDefaultMaterial extends THREE.MeshBasicNodeMaterial
{
	public hasCoreShadows: boolean
	public hasDropShadows: boolean
	public hasFog: boolean
	public hasLightBounce: boolean

	private _colorNode: ShaderNodeObject<Node>
	private _normalNode: ShaderNodeObject<Node>
	private _shadowNode: ShaderNodeObject<Node>
	private game: Game

	constructor(parameters: MeshDefaultMaterialParameters = {})
	{
		super(parameters)

		this.game = Game.getInstance()

		// Properties
		this.lights = false // 시스템 조명 끄기
		this.depthWrite = parameters.depthWrite ?? true
		this.depthTest = parameters.depthTest ?? true
		this.side = parameters.side ?? THREE.FrontSide
		this.transparent = parameters.transparent ?? false
		this.shadowSide = parameters.shadowSide ?? THREE.FrontSide

		// Features
		this.hasCoreShadows = parameters.hasCoreShadows ?? true
		this.hasDropShadows = parameters.hasDropShadows ?? true
		this.hasLightBounce = parameters.hasLightBounce ?? true
		this.hasFog = parameters.hasFog ?? true

		// Nodes
		this._colorNode = parameters.colorNode ?? color(0xffffff)
		this._normalNode = parameters.normalNode ?? normalWorld
		this._shadowNode = parameters.shadowNode ?? float(0)
		this.alphaTest = parameters.alphaTest ?? 0.1

		// Lighting References (Lighting.ts의 Uniform 직접 참조)
		const lighting = this.game.lighting
		const lightDir =
			lighting?.directionUniform ?? uniform(vec3(0.5, 1, 0.5))
		const lightColor = lighting?.colorUniform ?? uniform(color(0xffffff))
		const lightIntensity = lighting?.intensityUniform ?? uniform(1)
		const shadowColor = lighting?.shadowColor ?? uniform(color(0x3d3d3d))
		const bounceColor = lighting?.bounceColor ?? uniform(color(0x82487f))

		// ---------------------------------------------------------------------------
		// 1. Shadow Catcher (시스템 그림자 값 가져오기)
		// ---------------------------------------------------------------------------
		const catchedShadow = float(1).toVar() // 1: 빛, 0: 그림자

		if (this.hasDropShadows)
		{
			; (this as any).receivedShadowNode = Fn(
				([shadow]: [ShaderNodeObject<Node>]) =>
				{
					catchedShadow.assign(shadow.r)
					return float(1)
				},
			)
		}

		// ---------------------------------------------------------------------------
		// 2. Output Node (최종 픽셀 쉐이더)
		// ---------------------------------------------------------------------------
		this.outputNode = Fn(() =>
		{
			// 변수 준비
			const baseColor = this._colorNode.toVar()
			const outputColor = vec3(baseColor).toVar()
			const reorientedNormal = this._normalNode.toVar()

			// BackFace Normal Correction
			if (
				this.side === THREE.DoubleSide ||
				this.side === THREE.BackSide
			)
			{
				If(frontFacing.not(), () => reorientedNormal.mulAssign(-1))
			}

			// A. Light Bounce (지면 반사광)
			if (this.hasLightBounce && lighting)
			{
				const bounceFactor = reorientedNormal
					.dot(vec3(0, -1, 0))
					.smoothstep(
						lighting.lightBounceEdgeLow,
						lighting.lightBounceEdgeHigh,
					)

				const bounceDistance = lighting.lightBounceDistance
					.sub(max(0, positionWorld.y))
					.div(lighting.lightBounceDistance)
					.max(0)
					.pow(2)

				const bounceMix = bounceFactor
					.mul(bounceDistance)
					.mul(lighting.lightBounceMultiplier)
				outputColor.assign(mix(outputColor, bounceColor, bounceMix))
			}

			// B. Directional Light (Diffuse)
			// N dot L 계산 (0~1)
			const lightFactor = reorientedNormal.dot(lightDir).max(0)

			// 빛 적용 (색상 * 빛세기 * 내적값)
			outputColor.mulAssign(
				lightColor.mul(lightIntensity).mul(lightFactor),
			)

			// C. Shadows Setup
			let coreShadowMix: ShaderNodeObject<Node> = float(0) // 자체 그림자
			let dropShadowMix: ShaderNodeObject<Node> = float(0) // 투영 그림자

			if (this.hasCoreShadows && lighting)
			{
				// Toon Shading: 빛의 각도에 따라 그림자 영역 결정
				const dot = reorientedNormal.dot(lightDir)
				// dot이 High보다 크면 1(빛), Low보다 작으면 0(그림자) -> 반전하여 믹스값 생성
				coreShadowMix = float(1).sub(
					dot.smoothstep(
						lighting.coreShadowEdgeHigh,
						lighting.coreShadowEdgeLow,
					),
				)
			}

			if (this.hasDropShadows)
			{
				// catchedShadow: 1(빛), 0(그림자) -> 반전
				dropShadowMix = float(1).sub(catchedShadow)
			}

			// D. Shadow Application
			if (this.hasCoreShadows || this.hasDropShadows)
			{
				// 두 그림자 중 더 강한 것 선택
				const combinedShadowMix = max(
					coreShadowMix,
					dropShadowMix,
					this._shadowNode,
				).clamp(0, 1)

				// 그림자 색상 적용 (Multiply Blending 방식)
				const targetShadowColor = baseColor.rgb.mul(shadowColor).rgb
				outputColor.assign(
					mix(outputColor, targetShadowColor, combinedShadowMix),
				)
			}

			// E. Alpha Test
			if (this.transparent)
			{
				// AlphaNode가 없으면 Texture의 a채널 등을 사용해야 함. 여기선 기본 1
				// 투명도 맵이 있다면 파라미터로 받아와야 함.
				// float(1).lessThan(this.alphaTest).discard()
			}

			return vec4(outputColor, float(1))
		})()
	}
}

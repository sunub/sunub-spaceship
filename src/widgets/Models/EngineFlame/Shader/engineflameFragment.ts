import type { ShaderNodeObject } from "three/tsl"
import {
	abs,
	Break,
	clamp,
	cos,
	dot,
	Fn,
	float,
	fract,
	If,
	Loop,
	mat2,
	max,
	min,
	mix,
	normalize,
	sin,
	smoothstep,
	sub,
	Var,
	vec2,
	vec3,
	vec4,
} from "three/tsl"
import type * as THREE from "three/webgpu"
import type { Node } from "three/webgpu"

type TSLNode = ShaderNodeObject<Node>
type Varying = ShaderNodeObject<Node>
type FlameOptions = {
	uTime: ShaderNodeObject<THREE.UniformNode<number>>
	uResolution: ShaderNodeObject<THREE.UniformNode<THREE.Vector2>>
	uLocalCameraPos: ShaderNodeObject<THREE.UniformNode<THREE.Vector3>>
	vUv: Varying
	vWorldPosition: Varying
	vPosition: Varying
	uMainColor: ShaderNodeObject<THREE.UniformNode<THREE.Color>>
	uBaseColor: ShaderNodeObject<THREE.UniformNode<THREE.Color>>
	uThrust: ShaderNodeObject<THREE.UniformNode<number>>
	uFlameLength: ShaderNodeObject<THREE.UniformNode<number>>
}

const S = Fn(([x, y, z]: [TSLNode, TSLNode, TSLNode]) => {
	return smoothstep(x, y, z)
})

const sat = Fn(([x]: [TSLNode]) => {
	return clamp(x, 0.0, 1.0)
})

const N = Fn(([x]: [TSLNode]) => {
	return fract(sin(x).mul(5346.1764))
})

const smin = Fn(([a, b, k]: [TSLNode, TSLNode, TSLNode]) => {
	const h = sub(b, a).div(k).mul(0.5).add(0.5).clamp(0.0, 1.0)

	const smoothing = k.mul(h).mul(sub(1.0, h))
	const distance = mix(b, a, h).sub(smoothing)
	return vec2(distance, h)
})

const sdSphere = Fn(([p, pos, s]: [TSLNode, TSLNode, TSLNode]) => {
	return sub(p, pos).length().sub(s)
})

const sdCappedCylinder = Fn(([p, h]: [TSLNode, TSLNode]) => {
	const d = abs(vec2(p.xz.length(), p.y)).sub(h)
	return d.x.max(d.y).min(0.0).add(d.max(0.0).length())
})

export const opCheapBend = Fn(([p, strength]: [TSLNode, TSLNode]) => {
	const angle = strength.mul(p.y)
	const c = cos(angle)
	const s = sin(angle)

	const m = (mat2 as any)(c, s.negate(), s, c)
	const q = vec3(m.mul(p.xy), p.z)
	return q
})

export const fmap = Fn(
	([p_in, n, uTime, uFlameLength]: [TSLNode, TSLNode, TSLNode, TSLNode]) => {
		// 1. 입력받은 p를 수정해야 하므로 Var로 복사
		const p = Var(p_in)
		const t = uTime.mul(2.0)

		// p.z 변형
		p.z.mulAssign(1.5)

		// Spikes (불꽃 일렁임)
		const spikeBaseA = p.x.mul(50.0).add(t.mul(2.0)).sin().abs().pow(5.0)
		const spikeBaseB = p.x.mul(-30.0).add(t.mul(1.0)).sin().abs().pow(5.0)
		const spikes = spikeBaseA.mul(spikeBaseB)

		// p.y 변형
		p.y.addAssign(spikes.mul(0.1).mul(smoothstep(1.5, 3.0, p.y)))

		// opCheapBend (공간 휘기)
		const q = opCheapBend(p.add(vec3(0.0, 0.2, 0.0)), float(1.0))

		// --- 거리(d) 계산 시작 ---
		// 1. 심지 (Wick)
		const wickHeight = mix(0.1, 0.7, uFlameLength)
		// sdCappedCylinder 호출 후 -0.01
		const wick = sdCappedCylinder(
			q.add(vec3(0.0, 0.1, 0.0)),
			vec2(0.01, wickHeight),
		).sub(0.01)

		// d와 flame 초기값 설정
		const d = Var(wick) // GLSL: float d = wick;
		const flame = Var(wick) // GLSL: float flame = wick;

		// 2. 불꽃 구체 쌓기 (Loop)
		const top = float(2.2).sub(n.mul(n)).mul(uFlameLength).add(0.3)
		const iterations = 20

		Loop(iterations, ({ i: loopIndex }) => {
			const i = float(loopIndex).div(float(iterations))

			const y = mix(0.3, top, i)
			// x 계산식 (복잡하지만 차근차근)
			const wave = y.sub(t.mul(2.0)).sin().abs().pow(2.0)
			const x = wave.mul(0.1).mul(n).mul(p.y).mul(n).mul(n).mul(n)

			const size = mix(0.1, 0.05, i.mul(i))
			const smth = mix(0.4, 0.1, i)

			const spherePos = vec3(x.sub(0.12), y, 0.0)

			// smin().x 만 가져와서 flame에 할당
			flame.assign(smin(flame, sdSphere(p, spherePos, size), smth).x)
		})

		// 3. 최종 합성
		d.assign(min(d, flame))

		// 바닥 구체 빼기 (max(d, -sphere))
		const bottomSphere = sdSphere(p, vec3(-0.2, -0.5, 0.0), float(0.5))
		d.assign(max(d, bottomSphere.negate()))

		// 결과 반환 (거리값 d / 1.5)
		return d.div(1.5)
	},
)

export const castRay = Fn(
	([ro, rd, n, uTime, uFlameLength]: [
		TSLNode,
		TSLNode,
		TSLNode,
		TSLNode,
		TSLNode,
	]) => {
		// 변수 초기화
		const fd = Var(float(0.0)) // 총 이동 거리
		const s = Var(float(1000.0)) // Glow용 최소 거리 (매우 큰 값으로 초기화)
		const sd = Var(float(0.0)) // Glow 발생 위치의 깊이
		const isFlame = Var(float(0.0)) // 불꽃 충돌 여부 (0: 안 맞음, 1: 맞음)

		// 상수 정의
		const MAX_STEPS = 100
		const RAY_PRECISION = 0.01
		const dmax = float(200.0)

		// 레이마칭 루프
		Loop(MAX_STEPS, () => {
			// 1. 현재 레이의 위치 계산 (ro + rd * fd)
			const p = ro.add(rd.mul(fd))

			// 2. 거리 함수(SDF) 호출
			const d = fmap(p, n, uTime, uFlameLength)

			// 3. Glow 계산 (광선이 물체 옆을 얼마나 가깝게 스쳐 지나갔는가?)
			If(d.lessThan(s), () => {
				s.assign(d) // 최소 거리 갱신
				sd.assign(fd) // 그때의 깊이 저장
			})

			// 4. 총 이동 거리 누적 (전진)
			fd.addAssign(d)

			// --- [수정된 부분] 충돌 및 탈출 로직 ---

			// Case A: 물체에 충돌함 (거리가 정밀도보다 작음)
			If(d.lessThan(RAY_PRECISION), () => {
				isFlame.assign(1.0) // "충돌했음" 깃발을 꽂음
				Break() // 루프 즉시 종료
			})

			// Case B: 너무 멀리 날아감 (화면 밖)
			If(fd.greaterThan(dmax), () => {
				isFlame.assign(0.0) // (혹시 모르니 확실히 0)
				Break() // 루프 종료
			})
		})

		// 반환: 렌더링에 필요한 정보들을 vec4로 묶어서 내보냄
		// x: 총 거리 (fd)
		// y: Glow 최소 거리 (s)
		// z: Glow 위치 (sd)
		// w: 불꽃 충돌 여부 (isFlame)
		return vec4(fd, s, sd, isFlame)
	},
)

const flameNormal = Fn(
	([p, n, uTime, uFlameLength]: [TSLNode, TSLNode, TSLNode, TSLNode]) => {
		const eps = vec3(0.001, 0.0, 0.0)
		const nor = vec3(
			fmap(p.add(eps.xyy), n, uTime, uFlameLength).sub(
				fmap(p.sub(eps.xyy), n, uTime, uFlameLength),
			),
			fmap(p.add(eps.yxy), n, uTime, uFlameLength).sub(
				fmap(p.sub(eps.yxy), n, uTime, uFlameLength),
			),
			fmap(p.add(eps.yyx), n, uTime, uFlameLength).sub(
				fmap(p.sub(eps.yyx), n, uTime, uFlameLength),
			),
		)
		return normalize(nor)
	},
)

const render = Fn(
	([ro, rd, n, uTime, uFlameLength, uMainColor, uBaseColor]: [
		TSLNode,
		TSLNode,
		TSLNode,
		TSLNode,
		TSLNode,
		TSLNode,
		TSLNode,
	]) => {
		// 배경색 초기화 (검정)
		const col = Var(vec3(0.0))

		// castRay 호출
		// 결과 vec4 매핑: x=fd(총거리), y=s(Glow최소거리), z=sd(Glow깊이), w=isFlame(충돌여부)
		const rayResult = castRay(ro, rd, n, uTime, uFlameLength)
		const fd = rayResult.x
		const s = rayResult.y
		const sd = rayResult.z
		const isFlame = rayResult.w

		// --- 불꽃 렌더링 ---
		// GLSL: if(o.f > 0. && o.fd < 100.)
		If(isFlame.greaterThan(0.0).and(fd.lessThan(100.0)), () => {
			const p = ro.add(rd.mul(fd))
			const nor = flameNormal(p, n, uTime, uFlameLength)

			// Fresnel
			const fresnel = sat(dot(nor, rd.negate()))
			const flame = Var(float(1.0))

			// 색상 그라데이션 (Vertical Gradients)
			flame.mulAssign(S(float(-0.1), float(0.8), p.y))
			flame.mulAssign(S(float(3.5), float(1.0), p.y))
			flame.mulAssign(S(float(2.5), float(2.0), p.y))

			const bottomFade = S(float(0.05), float(0.2), p.y)

			// 메인 컬러 합성
			// GLSL: col = mix(col, uMainColor*3., flame*fresnel*bottomFade);
			const flameIntensity = flame.mul(fresnel).mul(bottomFade)
			col.assign(mix(col, uMainColor.mul(3.0), flameIntensity))

			// 파란 불꽃 (Blue Core)
			const blue = Var(S(float(0.4), float(-0.0), p.y))
			// fresnel 제곱
			blue.mulAssign(S(float(0.7), float(0.3), fresnel.mul(fresnel)))

			// GLSL: col += uBaseColor * blue * bottomFade;
			col.addAssign(uBaseColor.mul(blue).mul(bottomFade))
		})

		// --- Glow (후광) 효과 ---
		// GLSL: vec3 p = ro + rd * o.sd;
		const pGlow = ro.add(rd.mul(sd))
		// Calculate dynamic center and range for glow based on flame length
		// Revert to original height logic for better volume, but control tip with topFade
		const flameHeight = uFlameLength.mul(2.0).add(0.5)
		const center = flameHeight.mul(0.5)

		const y = pGlow.y.sub(center)
		const range = center.max(0.1) // Avoid division by zero
		const normY = y.div(range)

		// Parabolic falloff: 1.0 at center, 0.0 at center +/- range
		const gw = Var(sat(float(1.0).sub(normY.mul(normY))))
		gw.mulAssign(gw) // gw *= gw

		// GLSL: float glow = S(.25*gw, 0., o.s)*.5;
		const glow = Var(S(gw.mul(0.25), float(0.0), s).mul(0.5))
		glow.mulAssign(glow) // glow *= glow

		// GLSL: col = max(col, glow * uMainColor);
		// Re-calculate bottom fade for glow position
		const glowBottomFade = S(float(0.05), float(0.2), pGlow.y)

		// Create Top Fade to remove artifacts at the tip
		// Flame tip roughly around 2.2 * length + 0.3 (max noise)
		const flameTip = uFlameLength.mul(2.2).add(0.3)
		// Fade out before the tip
		const glowTopFade = float(1.0).sub(
			S(flameTip.sub(0.8), flameTip, pGlow.y),
		)

		// Apply both bottom and top fades
		col.assign(
			max(col, glow.mul(uMainColor).mul(glowBottomFade).mul(glowTopFade)),
		)

		return col
	},
)

export default function main(options: FlameOptions) {
	// 옵션 구조 분해 할당
	const {
		uLocalCameraPos,
		vPosition,
		uTime,
		uThrust,
		uFlameLength,
		uMainColor,
		uBaseColor,
	} = options

	// 1. Ray Origin & Direction
	const ro = uLocalCameraPos
	const rd = normalize(vPosition.sub(uLocalCameraPos))

	// 2. 시간 노이즈 (Time Noise)
	const t = uTime.mul(6.2831)
	// N 함수는 외부 혹은 상단에 정의되어 있어야 함
	const n = mix(N(t.floor()), N(t.add(1.0).floor()), fract(t))

	// 3. 렌더링 수행
	const col = render(ro, rd, n, uTime, uFlameLength, uMainColor, uBaseColor)

	// 4. 투명도(Alpha) 처리
	const alpha = col.length()

	// 추력(Thrust)에 따른 투명도 조절
	// GLSL: alpha * 2.0 * smoothstep(0.01, 1.0, uThrust)
	const finalAlpha = alpha.mul(2.0).mul(smoothstep(0.01, 1.0, uThrust))

	// 최종 결과 반환 (vec4)
	return vec4(col, finalAlpha)
}

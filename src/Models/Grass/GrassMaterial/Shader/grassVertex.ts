import type { ShaderNodeObject } from "three/tsl"
import {
    abs,
    add,
    attribute,
    cameraPosition,
    cameraProjectionMatrix,
    clamp,
    cos,
    cross,
    distance,
    div,
    dot,
    Fn,
    float,
    floor,
    fract,
    int,
    length,
    mat2,
    mat3,
    max,
    mix,
    modelViewMatrix,
    modelWorldMatrix,
    mul,
    normalize,
    pow,
    select,
    sin,
    smoothstep,
    sub,
    varying,
    vec3,
    vec4,
    vertexIndex,
} from "three/tsl"
import type * as THREE from "three/webgpu"
import type { Node } from "three/webgpu"

// --- Helper Functions ---

const inverseLerp = (
    v: ShaderNodeObject<Node>,
    minValue: ShaderNodeObject<Node>,
    maxValue: ShaderNodeObject<Node>,
) => {
    return div(sub(v, minValue), sub(maxValue, minValue))
}

const remap = (
    v: ShaderNodeObject<Node>,
    inMin: ShaderNodeObject<Node>,
    inMax: ShaderNodeObject<Node>,
    outMin: ShaderNodeObject<Node>,
    outMax: ShaderNodeObject<Node>,
) => {
    const t = inverseLerp(v, inMin, inMax)
    return mix(outMin, outMax, t)
}

const saturateValue = (x: ShaderNodeObject<Node>) => {
    return clamp(x, float(0.0), float(1.0))
}

const hash = Fn(([p]: [ShaderNodeObject<Node>]) => {
    const p3 = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6)),
    )
    return fract(mul(sin(p3), float(43758.5453123)))
        .mul(2.0)
        .sub(1.0)
})

const noise = Fn(([p]: [ShaderNodeObject<Node>]) => {
    const i = floor(p)
    const f = fract(p)
    const u = mul(f, f, sub(3.0, mul(2.0, f)))

    const gradientDot = (offset: ShaderNodeObject<Node>) => {
        return dot(hash(add(i, offset)), sub(f, offset))
    }

    const v000 = gradientDot(vec3(0.0, 0.0, 0.0))
    const v100 = gradientDot(vec3(1.0, 0.0, 0.0))
    const v010 = gradientDot(vec3(0.0, 1.0, 0.0))
    const v110 = gradientDot(vec3(1.0, 1.0, 0.0))

    const v001 = gradientDot(vec3(0.0, 0.0, 1.0))
    const v101 = gradientDot(vec3(1.0, 0.0, 1.0))
    const v011 = gradientDot(vec3(0.0, 1.0, 1.0))
    const v111 = gradientDot(vec3(1.0, 1.0, 1.0))

    const avgX1 = mix(v000, v100, u.x)
    const avgX2 = mix(v010, v110, u.x)
    const avgY1 = mix(avgX1, avgX2, u.y)

    const avgX3 = mix(v001, v101, u.x)
    const avgX4 = mix(v011, v111, u.x)
    const avgY2 = mix(avgX3, avgX4, u.y)

    return mix(avgY1, avgY2, u.z)
})

const easeOut = (x: ShaderNodeObject<Node>, t: ShaderNodeObject<Node>) => {
    return sub(1.0, pow(sub(1.0, x), t))
}

const rotateY = (theta: ShaderNodeObject<Node>) => {
    const c = cos(theta)
    const s = sin(theta)
    // @ts-expect-error
    return mat3(vec3(c, 0, s), vec3(0, 1, 0), vec3(sub(0.0, s), 0, c))
}

const rotateAxis = (
    axis: ShaderNodeObject<Node>,
    angle: ShaderNodeObject<Node>,
) => {
    const s = sin(angle)
    const c = cos(angle)
    const oc = sub(1.0, c)

    const x = axis.x
    const y = axis.y
    const z = axis.z

    const m00 = add(mul(oc, x, x), c)
    const m01 = sub(mul(oc, x, y), mul(z, s))
    const m02 = add(mul(oc, z, x), mul(y, s))

    const m10 = add(mul(oc, x, y), mul(z, s))
    const m11 = add(mul(oc, y, y), c)
    const m12 = sub(mul(oc, y, z), mul(x, s))

    const m20 = sub(mul(oc, z, x), mul(y, s))
    const m21 = add(mul(oc, y, z), mul(x, s))
    const m22 = add(mul(oc, z, z), c)

    // @ts-expect-error
    return mat3(vec3(m00, m01, m02), vec3(m10, m11, m12), vec3(m20, m21, m22))
}

const bezier = (
    P0: ShaderNodeObject<Node>,
    P1: ShaderNodeObject<Node>,
    P2: ShaderNodeObject<Node>,
    P3: ShaderNodeObject<Node>,
    t: ShaderNodeObject<Node>,
) => {
    const oneMinusT = sub(1.0, t)
    const t2 = mul(t, t)
    const oneMinusT2 = mul(oneMinusT, oneMinusT)

    const term1 = mul(oneMinusT2, oneMinusT, P0)
    const term2 = mul(float(3.0), oneMinusT2, t, P1)
    const term3 = mul(float(3.0), oneMinusT, t2, P2)
    const term4 = mul(t2, t, P3)

    return add(term1, term2, term3, term4)
}

const bezierGrad = (
    P0: ShaderNodeObject<Node>,
    P1: ShaderNodeObject<Node>,
    P2: ShaderNodeObject<Node>,
    P3: ShaderNodeObject<Node>,
    t: ShaderNodeObject<Node>,
) => {
    const oneMinusT = sub(1.0, t)

    const term1 = mul(float(3.0), mul(oneMinusT, oneMinusT), sub(P1, P0))
    const term2 = mul(float(6.0), oneMinusT, t, sub(P2, P1))
    const term3 = mul(float(3.0), mul(t, t), sub(P3, P2))

    return add(term1, term2, term3)
}

// --- Main Logic ---

export default function grassVertex(
    grassParams: ShaderNodeObject<THREE.UniformNode<THREE.Vector4>>,
    time: ShaderNodeObject<THREE.UniformNode<number>>,
    uPlayerPosition: ShaderNodeObject<THREE.UniformNode<THREE.Vector3>>,
    uInteractionRadius: ShaderNodeObject<THREE.UniformNode<number>>,
    uCenter: ShaderNodeObject<THREE.UniformNode<THREE.Vector3>>,
    uVisibleRadius: ShaderNodeObject<THREE.UniformNode<number>>,
) {
    // Varyings
    const vColor = varying(vec3(0.0), "vColor")
    const vNormal = varying(vec3(0.0), "vNormal")
    const vWorldPosition = varying(vec3(0.0), "vWorldPosition")
    const vGrassData = varying(vec4(0.0), "vGrassData")

    const main = Fn(() => {
        const GRASS_SEGMENTS = int(grassParams.x)
        const GRASS_VERTICES = mul(add(GRASS_SEGMENTS, 1), 2)
        const GRASS_WIDTH = grassParams.z
        const GRASS_HEIGHT = grassParams.w

        const aInstancePosition = attribute("aInstancePosition", "vec3")
        const grassOffset = aInstancePosition

        const grassBladeWorldPos = mul(
            modelWorldMatrix,
            vec4(grassOffset, 1.0),
        ).xyz
        const hashVal = hash(grassBladeWorldPos)
        const cameraDistToBlade = distance(cameraPosition, grassBladeWorldPos)
        const stabilizeFactor = smoothstep(
            float(35.0),
            float(120.0),
            cameraDistToBlade,
        )

        const grassType = float(
            select(saturateValue(hashVal.z).greaterThan(0.75), 1.0, 0.0),
        )

        // Rotation
        const PI = float(Math.PI)
        const angle = remap(hashVal.x, float(-1.0), float(1.0), PI.negate(), PI)

        const stiffness = float(0.5)
        const tileGrassHeight = mix(1.0, 1.5, grassType)

        // Vertex ID
        const vertFB_ID = int(vertexIndex).mod(mul(GRASS_VERTICES, 2))
        const vertID = vertFB_ID.mod(GRASS_VERTICES)

        const xTest = vertID.bitAnd(1)
        const zTest = select(vertFB_ID.greaterThanEqual(GRASS_VERTICES), 1, -1)
        const xSide = float(xTest)
        const zSide = float(zTest)

        const heightPercent = div(
            float(sub(vertID, xTest)),
            mul(float(GRASS_SEGMENTS), 2.0),
        )

        const width = mul(
            GRASS_WIDTH,
            easeOut(sub(1.08, heightPercent), float(2.0)),
        )
        const height = mul(GRASS_HEIGHT, tileGrassHeight)

        // Height randomization
        const randomHeight = mul(hashVal.y, 0.1)
        const finalHeight = add(height, randomHeight)

        const isInvalid = finalHeight.lessThan(0.3)

        // --- Distance-based fade (computed early using instance world position) ---
        const distFromCenter = distance(grassBladeWorldPos, uCenter)
        const fadeStart = mul(uVisibleRadius, 0.8)
        const fadeEnd = mul(uVisibleRadius, 1.12)
        const fadeFactor = smoothstep(fadeStart, fadeEnd, distFromCenter)
        const distanceScale = sub(1.0, fadeFactor)

        const x = mul(sub(xSide, 0.5), width)

        // Wind and Leaning
        const windScale = float(0.5)
        const windSpeed = float(1.0)

        const windStrength = noise(
            add(
                vec3(mul(grassBladeWorldPos.xz, windScale), 0.0),
                mul(time, windSpeed),
            ),
        )
        const stabilizedWindStrength = mix(
            windStrength,
            mul(windStrength, 0.35),
            stabilizeFactor,
        )

        const flutter = mul(
            noise(
                add(vec3(mul(grassBladeWorldPos.xz, 1.0), 0.0), mul(time, 1.5)),
            ),
            0.1,
        )
        const stabilizedFlutter = mix(
            flutter,
            mul(flutter, 0.2),
            stabilizeFactor,
        )

        const windCombined = add(stabilizedWindStrength, stabilizedFlutter)

        const windAngle = add(0.0, mul(windCombined, 0.2))
        const windAxis = vec3(cos(windAngle), 0.0, sin(windAngle))

        const windLeanAngle = mul(windCombined, 1.0, heightPercent, stiffness)

        const randomLeanAnimation = mul(
            noise(vec3(grassBladeWorldPos.xz, mul(time, 1.5))),
            add(mul(windCombined, 0.5), 0.125),
        )
        const stabilizedLeanAnimation = mix(
            randomLeanAnimation,
            mul(randomLeanAnimation, 0.2),
            stabilizeFactor,
        )

        const leanFactor = add(
            remap(hashVal.y, float(-1.0), float(1.0), float(-0.2), float(0.2)),
            stabilizedLeanAnimation,
        )

        // Interaction Logic
        const dist = distance(grassBladeWorldPos, uPlayerPosition)
        const radius = max(0.001, uInteractionRadius)

        const falloff = sub(1.0, smoothstep(0.0, radius, dist))

        const rawPushDir = normalize(sub(grassBladeWorldPos, uPlayerPosition))
        const flatDir = vec3(rawPushDir.x, 0.0, rawPushDir.z)
        const flatLen = length(flatDir)

        const safePushDir = select(
            flatLen.greaterThan(0.001),
            normalize(flatDir),
            vec3(1.0, 0.0, 0.0),
        )

        const interactionAxis = cross(vec3(0.0, 1.0, 0.0), safePushDir)
        const interactionStrength = mul(falloff.negate(), 0.8, heightPercent)
        const squashFactor = sub(1.0, mul(falloff, 0.8))
        const darkenFactor = falloff

        const interactionMat = rotateAxis(interactionAxis, interactionStrength)
        const windMat = rotateAxis(windAxis, windLeanAngle)
        const localRot = rotateY(angle)

        const grassMat = mul(interactionMat, mul(windMat, localRot))

        // Bezier
        const p1 = vec3(0.0)
        const p2 = vec3(0.0, 0.5, 0.0)
        const p3 = vec3(0.0, 0.8, 0.0)
        const p4 = vec3(0.0, cos(leanFactor), sin(leanFactor))

        const curve = bezier(p1, p2, p3, p4, heightPercent)
        const curveGrad = bezierGrad(p1, p2, p3, p4, heightPercent)

        // @ts-expect-error
        const curveRot90 = mul(mat2(0.0, 1.0, -1.0, 0.0), zSide.negate())

        const y = mul(curve.y, finalHeight, squashFactor, distanceScale)
        const z = mul(curve.z, finalHeight, squashFactor, distanceScale)

        const yFinal = select(heightPercent.lessThan(0.01), 0.0, y)
        const zFinal = select(heightPercent.lessThan(0.01), 0.0, z)

        const grassLocalPosition = add(
            mul(grassMat, vec3(x, yFinal, zFinal)),
            grassOffset,
        )

        // --- Normal Calculation Start ---

        // 1. 기하학적 법선 (실제 휘어진 풀잎의 법선)
        const exactLocalNormal = mul(
            grassMat,
            vec3(0.0, mul(curveRot90, curveGrad.yz)),
        )
        const exactWorldNormal = normalize(
            mul(modelWorldMatrix, vec4(exactLocalNormal, 0.0)).xyz,
        )

        // 2. 지형 법선 (보통 위쪽) - 빛을 부드럽게 받게 함
        const terrainNormal = vec3(0.0, 1.0, 0.0)

        // 3. Normal Blending (법선 혼합)
        // 0.0: 완전한 풀잎 법선 (그림자 짙음), 1.0: 지형 법선 (평평함)
        // 0.5 정도가 입체감과 부드러움의 균형이 좋음
        const blendRatio = float(0.5)
        const blendedWorldNormal = normalize(
            mix(exactWorldNormal, terrainNormal, blendRatio),
        )

        // 4. View Space 변환 (MeshStandardMaterial은 View Space Normal을 선호)
        // const viewNormal = normalize(
        //     mul(modelViewMatrix, vec4(blendedWorldNormal, 0.0)).xyz,
        // )
        // --- Normal Calculation End ---

        // View dependent effects (Thickening)
        const currentWorldPosition = mul(
            modelWorldMatrix,
            vec4(grassLocalPosition, 1.0),
        )
        const viewDir = normalize(sub(cameraPosition, currentWorldPosition.xyz))

        // 두께감 계산 시에는 블렌딩된 노말보다 실제 노말을 쓰는 것이 더 정확한 외곽선을 만듦
        const viewDotNormal = saturateValue(abs(dot(exactWorldNormal, viewDir)))
        const viewSpaceThickenFactor = pow(sub(1.0, viewDotNormal), float(3.0))
        const stabilizedThickenFactor = mix(
            viewSpaceThickenFactor,
            float(0.18),
            stabilizeFactor,
        )

        const mvPosition = mul(modelViewMatrix, vec4(grassLocalPosition, 1.0))
        const thickenOffset = mul(
            stabilizedThickenFactor,
            sub(xSide, 0.5),
            width,
            0.5,
        )
        mvPosition.x.addAssign(thickenOffset)

        // Colors
        const BASE_COLOR = vec3(0.35, 0.2, 0.01)
        const TIP_COLOR = vec3(0.5, 0.65, 0.46)

        const baseVColor = mix(BASE_COLOR, TIP_COLOR, heightPercent)
        const colorVar = mul(hashVal.x, 0.1)
        const finalVColor = add(
            baseVColor,
            vec3(mul(colorVar, 0.5), mul(colorVar, 0.2), mul(colorVar, 0.5)),
        )
        const darkenedColor = mul(finalVColor, sub(1.0, mul(0.6, darkenFactor)))

        vColor.assign(
            select(darkenFactor.greaterThan(0.0), darkenedColor, finalVColor),
        )

        // [중요] 계산된 View Space Normal을 vNormal에 할당 -> World Space Normal로 변경 (조명 계산 정확성 위함)
        vNormal.assign(blendedWorldNormal)

        vWorldPosition.assign(currentWorldPosition.xyz)
        vGrassData.assign(vec4(x, heightPercent, xSide, grassType))

        // --- Distance Culling (hard discard beyond visible radius) ---
        const cullingDiscard = distFromCenter.greaterThan(mul(uVisibleRadius, 1.25))

        // Combine discard conditions
        const shouldDiscard = isInvalid.or(tileGrassHeight.lessThan(0.25)).or(cullingDiscard)

        const finalPosition = mul(cameraProjectionMatrix, mvPosition)

        return select(shouldDiscard, vec4(2.0, 2.0, 2.0, 1.0), finalPosition)
    })

    const positionNode = main()

    return {
        positionNode,
        vNormal,
        vColor,
        vWorldPosition,
        vGrassData,
    }
}

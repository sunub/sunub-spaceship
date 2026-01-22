import {
    abs,
    div,
    float,
    mix,
    mul,
    pow,
    type ShaderNodeObject,
    smoothstep,
    sub,
} from "three/tsl"
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

// --- Main Fragment Logic ---

export default function grassFragment(
    vColor: ShaderNodeObject<Node>,
    vGrassData: ShaderNodeObject<Node>,
) {
    const grassX = vGrassData.x
    const grassY = vGrassData.y

    // Base Color Mix
    // 풀잎의 중심부는 진하게, 가장자리는 밝게 처리하여 두께감을 줌
    const baseColor = mix(
        mul(vColor, 0.75),
        vColor,
        sub(1.0, smoothstep(float(0.0), float(0.125), abs(grassX))),
    )

    // Fake AO (Ambient Occlusion)
    // 풀의 뿌리 부분(grassY가 0에 가까움)을 어둡게 처리하여 지면과 닿는 느낌을 줌
    const ao = remap(
        pow(grassY, float(2.0)),
        float(0.0),
        float(1.0),
        float(0.125), // 뿌리 부분의 최소 밝기
        float(1.0),
    )

    // Apply AO to base color
    // 이것이 Albedo(Base Color)가 되어 PBR 라이팅 계산의 입력값이 됩니다.
    const finalColor = mul(baseColor, ao)
    return finalColor
}

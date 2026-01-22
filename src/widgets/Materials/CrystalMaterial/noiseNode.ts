// Shader/noiseNode.ts
import {
    add,
    dot,
    Fn,
    float,
    floor,
    fract,
    mix,
    mul,
    type ShaderNodeObject,
    sub,
    vec3,
} from "three/tsl"
import type { Node } from "three/webgpu"

// 간단한 Hash 함수 (Randomness)
const hash = (p: ShaderNodeObject<Node>) => {
    const p3 = fract(mul(p, vec3(0.1031, 0.103, 0.0973)))
    const s_p3 = add(p3, dot(p3, add(p3.yxz, 33.33)))
    return fract(add(mul(s_p3.x, s_p3.y), s_p3.z))
}

// 3D Value Noise (부드러운 노이즈)
export const noise3D = (p: ShaderNodeObject<Node>) => {
    const i = floor(p)
    const f = fract(p)

    // Cubic Hermite Spline (smoothstep과 유사한 보간)
    const u = mul(f, mul(f, sub(3.0, mul(f, 2.0))))

    return mix(
        mix(
            mix(hash(add(i, vec3(0, 0, 0))), hash(add(i, vec3(1, 0, 0))), u.x),
            mix(hash(add(i, vec3(0, 1, 0))), hash(add(i, vec3(1, 1, 0))), u.x),
            u.y,
        ),
        mix(
            mix(hash(add(i, vec3(0, 0, 1))), hash(add(i, vec3(1, 0, 1))), u.x),
            mix(hash(add(i, vec3(0, 1, 1))), hash(add(i, vec3(1, 1, 1))), u.x),
            u.y,
        ),
        u.z,
    )
}

export const fbm = (p: ShaderNodeObject<Node>, octaves: number = 3) => {
    return Fn(() => {
        const value = float(0.0)
        const amplitude = float(0.5)
        const currentP = vec3(p)

        for (let i = 0; i < octaves; i++) {
            value.assign(add(value, mul(noise3D(currentP), amplitude)))

            if (i < octaves - 1) {
                currentP.assign(mul(currentP, 2.0))
                amplitude.assign(mul(amplitude, 0.5))
            }
        }

        return value
    })()
}

import {
    convertToTexture,
    Fn,
    int,
    Loop,
    max,
    nodeObject,
    premultiplyAlpha,
    textureSize,
    unpremultiplyAlpha,
    uv,
    vec2,
    vec4,
} from "three/tsl"

export interface BoxBlurOptions {
    size?: any
    separation?: any
    premultipliedAlpha?: boolean
}

export const boxBlur = /*#__PURE__*/ Fn(
    ([textureNode, options = {}]: [any, BoxBlurOptions]) => {
        const textureNodeConverted = nodeObject(convertToTexture(textureNode))

        const size = nodeObject(options.size) || int(1)
        const separation = nodeObject(options.separation) || int(1)
        const premultipliedAlpha = options.premultipliedAlpha || false

        const tap = (uv: any) => {
            const sample = textureNodeConverted.sample(uv)
            return premultipliedAlpha ? premultiplyAlpha(sample) : sample
        }

        const targetUV = textureNodeConverted.uvNode || uv()

        const result = vec4(0)
        const sep = max(separation, 1)
        const count = int(0)
        const pixelStep = vec2(1).div(textureSize(textureNodeConverted)) // 텍스처 크기에 따른 픽셀 단위 계산

        // 외부 루프 (X축 방향 등)
        Loop(
            { start: size.negate(), end: size, condition: "<=" }, // name 속성 제거
            ({ i }) => {
                // 내부 루프 (Y축 방향 등)
                Loop(
                    {
                        start: size.negate(),
                        end: size,
                        condition: "<=", // name 속성 제거
                    },
                    ({ i: j }) => {
                        const uvs = targetUV.add(
                            vec2(i, j).mul(pixelStep).mul(sep),
                        )
                        result.addAssign(tap(uvs))
                        count.addAssign(1)
                    },
                )
            },
        )

        result.divAssign(count)

        return premultipliedAlpha ? unpremultiplyAlpha(result) : result
    },
)

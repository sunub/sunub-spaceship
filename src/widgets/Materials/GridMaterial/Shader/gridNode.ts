import
	{
		abs,
		add,
		clamp,
		dFdx,
		dFdy,
		div,
		float,
		fract,
		length,
		mix,
		mul,
		pow,
		type ShaderNodeObject,
		smoothstep,
		step,
		sub,
		vec2,
		vec3,
		vec4,
	} from "three/tsl"
import type { Node } from "three/webgpu"

function pristineGrid(
	uvInput: ShaderNodeObject<Node>,
	lineWidthInput: ShaderNodeObject<Node>,
)
{
	const ddx = vec2(dFdx(uvInput.x), dFdx(uvInput.y))
	const ddy = vec2(dFdy(uvInput.x), dFdy(uvInput.y))

	const uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)))

	const invertLineX = step(0.5, lineWidthInput.x)
	const invertLineY = step(0.5, lineWidthInput.y)

	const targetWidthX = mix(
		lineWidthInput.x,
		sub(float(1.0), lineWidthInput.x),
		invertLineX,
	)

	const targetWidthY = mix(
		lineWidthInput.y,
		sub(float(1.0), lineWidthInput.y),
		invertLineY,
	)

	const targetWidth = vec2(targetWidthX, targetWidthY)

	const drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5))
	const lineAA = mul(uvDeriv, float(1.5))

	const gridUVBase = abs(sub(mul(fract(uvInput), float(2.0)), float(1.0)))
	const gridUV_x = mix(
		sub(float(1.0), gridUVBase.x),
		gridUVBase.x,
		invertLineX,
	)
	const gridUV_y = mix(
		sub(float(1.0), gridUVBase.y),
		gridUVBase.y,
		invertLineY,
	)
	const gridUV = vec2(gridUV_x, gridUV_y)

	// WGSL requires smoothstep(low, high, x) where low < high.
	// The original GLSL used smoothstep(high, low, x) for inversion.
	// We replace this with 1.0 - smoothstep(low, high, x).
	const grid2Initial = sub(
		1.0,
		smoothstep(sub(drawWidth, lineAA), add(drawWidth, lineAA), gridUV),
	)
	const intensityCorrection = clamp(
		div(targetWidth, drawWidth),
		vec2(0.0),
		vec2(1.0),
	)
	const grid2Corrected = mul(grid2Initial, intensityCorrection)

	const distanceFactor = clamp(
		sub(mul(uvDeriv, float(2.0)), float(1.0)),
		vec2(0.0),
		vec2(1.0),
	)
	const grid2Distance = mix(grid2Corrected, targetWidth, distanceFactor)

	const grid2X = mix(
		grid2Distance.x,
		sub(float(1.0), grid2Distance.x),
		invertLineX,
	)
	const grid2Y = mix(
		grid2Distance.y,
		sub(float(1.0), grid2Distance.y),
		invertLineY,
	)
	return mix(grid2X, 1.0, grid2Y)
}

export default function main(
	vUv: ShaderNodeObject<Node>,
	u_gridDensity: ShaderNodeObject<Node>,
	u_gridThickness: ShaderNodeObject<Node>,
)
{
	const uvNode = mul(vUv, u_gridDensity)
	const N = float(1.0)
	const lineWidth = vec2(div(u_gridThickness, N), div(u_gridThickness, N))
	const gridValue = pristineGrid(uvNode, lineWidth)
	let finalColor = mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), gridValue)
	finalColor = pow(finalColor, vec3(0.4545))
	return vec4(finalColor, 1.0)
}

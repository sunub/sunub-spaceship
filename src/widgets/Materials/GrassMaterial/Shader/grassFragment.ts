import
	{
		abs,
		add,
		cameraPosition,
		clamp,
		div,
		dot,
		float,
		max,
		mix,
		mul,
		normalize,
		pow,
		reflect,
		type ShaderNodeObject,
		smoothstep,
		sub,
		varying,
		vec3,
		vec4,
	} from "three/tsl"
import type { Node } from "three/webgpu"

// --- Helper Functions ---

const inverseLerp = (
	v: ShaderNodeObject<Node>,
	minValue: ShaderNodeObject<Node>,
	maxValue: ShaderNodeObject<Node>,
) =>
{
	return div(sub(v, minValue), sub(maxValue, minValue))
}

const remap = (
	v: ShaderNodeObject<Node>,
	inMin: ShaderNodeObject<Node>,
	inMax: ShaderNodeObject<Node>,
	outMin: ShaderNodeObject<Node>,
	outMax: ShaderNodeObject<Node>,
) =>
{
	const t = inverseLerp(v, inMin, inMax)
	return mix(outMin, outMax, t)
}

const saturateValue = (x: ShaderNodeObject<Node>) =>
{
	return clamp(x, float(0.0), float(1.0))
}

// const lambertLight = (normal: ShaderNodeObject<Node>, viewDir: ShaderNodeObject<Node>, lightDir: ShaderNodeObject<Node>, lightColor: ShaderNodeObject<Node>) =>
// {
// 	const wrap = float(0.5)
// 	const dotNL = saturateValue(div(add(dot(normal, lightDir), wrap), add(1.0, wrap)))
// 	const lighting = vec3(dotNL)

// 	const backlight = saturateValue(div(add(dot(viewDir, lightDir.negate()), wrap), add(1.0, wrap)))
// 	const scatter = vec3(pow(backlight, float(2.0)))

// 	return mul(add(lighting, scatter), lightColor)
// }

const hemiLight = (
	normal: ShaderNodeObject<Node>,
	groundColor: ShaderNodeObject<Node>,
	skyColor: ShaderNodeObject<Node>,
) =>
{
	return mix(groundColor, skyColor, add(mul(0.5, normal.y), 0.5))
}

const phongSpecular = (
	normal: ShaderNodeObject<Node>,
	lightDir: ShaderNodeObject<Node>,
	viewDir: ShaderNodeObject<Node>,
) =>
{
	const dotNL = saturateValue(dot(normal, lightDir))
	// reflect(I, N) -> I is incident. lightDir points TO light? No, standard is usually FROM light or TO light.
	// In GLSL: reflect(-lightDir, normal). -lightDir is incident (pointing to surface).
	const r = normalize(reflect(lightDir.negate(), normal))

	// max(0.0, dot(viewDir, r))
	let phongValue = max(float(0.0), dot(viewDir, r))
	phongValue = pow(phongValue, float(16.0))

	return mul(dotNL, vec3(phongValue), 0.5)
}

// --- Main Fragment Logic ---

export default function grassFragment()
{
	// Re-declare varyings to access them
	const vColor = varying(vec3(0.0), "vColor")
	const vNormal = varying(vec3(0.0), "vNormal")
	const vWorldPosition = varying(vec3(0.0), "vWorldPosition")
	const vGrassData = varying(vec4(0.0), "vGrassData")

	const grassX = vGrassData.x
	const grassY = vGrassData.y
	// vGrassData.z is side, w is type - not used here? matches GLSL

	const normal = normalize(vNormal)
	const viewDir = normalize(sub(cameraPosition, vWorldPosition))

	// Base Color Mix
	// mix(vColor * 0.75, vColor, smoothstep(0.125, 0.0, abs(grassX)))
	const baseColor = mix(
		mul(vColor, 0.75),
		vColor,
		sub(1.0, smoothstep(float(0.0), float(0.125), abs(grassX))),
	)

	// Hemi Light
	const c1 = vec3(1.0, 1.0, 0.75)
	const c2 = vec3(0.05, 0.05, 0.25)
	const ambientLighting = hemiLight(normal, c2, c1)

	// Directional Light
	const lightDir = normalize(vec3(-1.0, 0.5, 1.0))
	// const lightColor = vec3(1.0)
	// const diffuseLighting = lambertLight(normal, viewDir, lightDir, lightColor)

	// Specular
	const specular = phongSpecular(normal, lightDir, viewDir)

	// Fake AO
	// remap(pow(grassY, 2.0), 0.0, 1.0, 0.125, 1.0)
	const ao = remap(
		pow(grassY, float(2.0)),
		float(0.0),
		float(1.0),
		float(0.125),
		float(1.0),
	)

	// Lighting Combine
	// diffuse * 0.5 + ambient * 0.5

	// const lighting = add(mul(diffuseLighting, 0.5), mul(ambientLighting, 0.5))

	// Final Color
	// baseColor * ambientLighting + specular * 0.25
	// Wait, GLSL says: color = baseColor.xyz * ambientLighting + specular * 0.25;
	// But strictly, diffuse should participate?
	// GLSL line 79: vec3 color = baseColor.xyz * ambientLighting + specular * 0.25;
	// It ignores `lighting` variable calculated in line 77?
	// GLSL line 77: vec3 lighting = diffuseLighting * 0.5 + ambientLighting * 0.5;
	// GLSL line 79 doesn't use `lighting`. It uses `ambientLighting` directly.
	// I will follow GLSL exactly.

	let color = add(mul(baseColor, ambientLighting), mul(specular, 0.25))
	color = mul(color, ao)

	// Gamma correction
	// pow(color, vec3(1.0/2.2))
	const finalColor = pow(color, vec3(div(1.0, 2.2)))

	return vec4(finalColor, 1.0)
}

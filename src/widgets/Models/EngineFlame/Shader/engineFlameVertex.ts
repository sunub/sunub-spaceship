import type { ShaderNodeObject } from "three/tsl"
import {
	cameraProjectionMatrix,
	Fn,
	modelViewMatrix,
	modelWorldMatrix,
	positionLocal,
	uv,
	vec4,
} from "three/tsl"
import type { Node } from "three/webgpu"

export default function engineFlameVertex(
	vUv: ShaderNodeObject<Node>,
	vWorldPosition: ShaderNodeObject<Node>,
	vPosition: ShaderNodeObject<Node>,
) {
	const main = Fn(() => {
		// vUv = uv;
		vUv.assign(uv())

		// vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1.0))

		// vWorldPosition = worldPosition.xyz;
		vWorldPosition.assign(worldPos.xyz)

		// vPosition = position;
		vPosition.assign(positionLocal)

		// gl_Position = projectionMatrix * viewMatrix * worldPosition;
		// equivalent to: projectionMatrix * modelViewMatrix * position
		return cameraProjectionMatrix
			.mul(modelViewMatrix)
			.mul(vec4(positionLocal, 1.0))
	})

	return main()
}

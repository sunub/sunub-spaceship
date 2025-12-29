import shaderFragment from "../Shader/glows/fragment.glsl"
import shaderVertex from "../Shader/glows/vertex.glsl"

export default {
	uniforms: {
		tDiffuse: { type: "t", value: null },
		uPosition: { type: "v2", value: null },
		uRadius: { type: "f", value: null },
		uColor: { type: "v3", value: null },
		uAlpha: { type: "f", value: null },
	},
	vertexShader: shaderVertex,
	fragmentShader: shaderFragment,
}

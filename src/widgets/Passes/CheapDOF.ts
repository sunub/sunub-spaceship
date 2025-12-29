import { convertToTexture, Fn, mix, nodeObject, uniform, uv } from "three/tsl"
import { type Node, TempNode, type TextureNode } from "three/webgpu"
import { boxBlur } from "./BoxBlur"

class CheapDOFNode extends TempNode {
	public textureNode: TextureNode
	public strength: any

	static get type() {
		return "CheapDOFNode"
	}

	constructor(textureNode: TextureNode) {
		super("vec4")

		this.textureNode = textureNode
		this.strength = uniform(2)
	}

	setup() {
		const outputNode = Fn(() => {
			const strength = uv().y.sub(0.5).abs().mul(this.strength).pow(2)

			// const strength = uv().sub(0.5).length().sub(0.3).max(0).mul(this.strength).pow(2)

			// return vec4(vec3(strength), 1)

			// return gaussianBlur(this.textureNode, 2, 3)

			// return hashBlur(this.textureNode, 0.01, {
			// 	repeats: 46,
			// 	premultipliedAlpha: true
			// })

			const blurOutput = boxBlur(this.textureNode, {
				size: 1,
				separation: 2,
			})

			return mix(this.textureNode, blurOutput, strength)
		})()

		return outputNode
	}
}

export default CheapDOFNode

export const cheapDOF = (node: Node) =>
	nodeObject(new CheapDOFNode(convertToTexture(node)))

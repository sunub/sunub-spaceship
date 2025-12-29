import type { ShaderNodeObject } from "three/tsl"
import type * as THREE from "three/webgpu"

declare global {
	type TSLNode<T extends THREE.Node> = ShaderNodeObject<T>
	type UniformNode<T> = ShaderNodeObject<THREE.UniformNode<T>>
}

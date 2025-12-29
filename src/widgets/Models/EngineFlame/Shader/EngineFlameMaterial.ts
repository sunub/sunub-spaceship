import { uniform, varying, vec2, vec3 } from "three/tsl"
import * as THREE from "three/webgpu"
import engineFlameVertex from "./engineFlameVertex"
import engineflameFragment from "./engineflameFragment"

export class EngineFlameMaterial extends THREE.NodeMaterial {
	public uTime: UniformNode<number>
	public uResolution: UniformNode<THREE.Vector2>
	public uLocalCameraPos: UniformNode<THREE.Vector3>
	public uMainColor: UniformNode<THREE.Color>
	public uBaseColor: UniformNode<THREE.Color>
	public uThrust: UniformNode<number>
	public uFlameLength: UniformNode<number>

	constructor() {
		super()

		const vUv = varying(vec2())
		const vWorldPosition = varying(vec3())
		const vPosition = varying(vec3())

		this.uTime = uniform(0.0)
		this.uResolution = uniform(
			new THREE.Vector2(window.innerWidth, window.innerHeight),
		)
		this.uLocalCameraPos = uniform(new THREE.Vector3())
		this.uMainColor = uniform(new THREE.Color(1.0, 0.27, 0.15))
		this.uBaseColor = uniform(new THREE.Color(0.25, 0.62, 0.79))
		this.uThrust = uniform(0.0)
		this.uFlameLength = uniform(0.1)

		this.vertexNode = engineFlameVertex(vUv, vWorldPosition, vPosition)
		this.fragmentNode = engineflameFragment({
			uTime: this.uTime,
			uResolution: this.uResolution,
			uLocalCameraPos: this.uLocalCameraPos,
			vUv: vUv,
			vWorldPosition: vWorldPosition,
			vPosition: vPosition,
			uMainColor: this.uMainColor,
			uBaseColor: this.uBaseColor,
			uThrust: this.uThrust,
			uFlameLength: this.uFlameLength,
		})

		this.side = THREE.FrontSide
		this.transparent = true
		this.depthWrite = false
		this.blending = THREE.AdditiveBlending
	}
}

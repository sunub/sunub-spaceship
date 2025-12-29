import { uniform } from "three/tsl"
import * as THREE from "three/webgpu"
import grassFragment from "./Shader/grassFragment"
import grassVertex from "./Shader/grassVertex"

export interface GrassMaterialOptions
{
	segments?: number
	patchSize?: number
	width?: number
	height?: number
	interactionRadius?: number
}

export class GrassMaterial extends THREE.NodeMaterial
{
	private _grassParams: any
	private _time: any
	private _uPlayerPosition: any
	private _uInteractionRadius: any

	constructor(options: GrassMaterialOptions = {})
	{
		super()

		const {
			segments = 5,
			patchSize = 1.0,
			width = 0.1,
			height = 1.0,
			interactionRadius = 3.0,
		} = options

		this._grassParams = uniform(
			new THREE.Vector4(segments, patchSize, width, height),
		)
		this._time = uniform(0)
		this._uPlayerPosition = uniform(new THREE.Vector3(0, -100, 0))
		this._uInteractionRadius = uniform(interactionRadius)

		// Assign TSL functions
		this.vertexNode = grassVertex(
			this._grassParams,
			this._time,
			this._uPlayerPosition,
			this._uInteractionRadius,
		)

		this.fragmentNode = grassFragment()

		this.side = THREE.DoubleSide
		// this.transparent = false; // Opaque for now, though grass usually likes alpha test?
		// The GLSL logic uses "discard" by moving vertices out of clip space, so opacity/alphaTest might not be strictly needed for geometry, but fragment shader is opaque.
	}

	// Accessors for TweakPane or updates

	get time()
	{
		return this._time.value
	}
	set time(v: number)
	{
		this._time.value = v
	}

	get playerPosition()
	{
		return this._uPlayerPosition.value
	}
	set playerPosition(v: THREE.Vector3)
	{
		this._uPlayerPosition.value.copy(v)
	}

	get interactionRadius()
	{
		return this._uInteractionRadius.value
	}
	set interactionRadius(v: number)
	{
		this._uInteractionRadius.value = v
	}

	// Helper to update specific grass params
	setGrassParams(
		segments: number,
		patchSize: number,
		width: number,
		height: number,
	)
	{
		this._grassParams.value.set(segments, patchSize, width, height)
	}
}

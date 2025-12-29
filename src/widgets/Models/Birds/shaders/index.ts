import fragment from "./fragment.glsl?raw"
import positionFragment from "./position_fragment.glsl?raw"
import velocityFragment from "./velocity_fragment.glsl?raw"
import vertext from "./vertex.glsl?raw"

export const BirdsShaders = {
	vertex: vertext,
	fragment: fragment,
	positionFragment: positionFragment,
	velocityFragment: velocityFragment,
} as const

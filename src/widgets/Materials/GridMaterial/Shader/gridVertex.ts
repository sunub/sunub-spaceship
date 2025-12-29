import { modelWorldMatrix, positionLocal, varying } from "three/tsl"

export default function getGridUV()
{
	const worldPosition = modelWorldMatrix.mul(positionLocal)
	return varying(worldPosition.xz)
}

// @ts-nocheck
import * as THREE from "three"
import { BaseModel } from "./BaseModel"

export class TreeLights extends BaseModel {
	constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
		super("treeLightsModel", position)
	}

	update(): void {
		// No specific update logic for now
	}
}

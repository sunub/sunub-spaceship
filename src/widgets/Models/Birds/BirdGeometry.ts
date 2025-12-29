import * as THREE from "three"
export class BirdGeometry extends THREE.BufferGeometry {
	constructor(width: number, birdsCount: number) {
		super()
		// 3D Model Structure
		// Body: 4 triangles (Pyramid-ish)
		// Wings: 2 triangles (Upper/Lower surface effective or just varying thickness) -> Let's do single sided but structured
		// Tail: 1 triangle

		// Vertices definition (Local space)
		// Body
		// 0: Head (0, 0, -10)
		// 1: TailRoot (0, 0, 5)
		// 2: Top (0, 2, 0)
		// 3: Bottom (0, -1, 0)
		// 4: LeftShoulder (-1.5, 0, -2)
		// 5: RightShoulder (1.5, 0, -2)

		// Wings
		// LeftTip (-18, 0, 0)
		// RightTip (18, 0, 0)

		// Tail
		// TailTip (0, 0, 12)
		// Let's build triangles.
		// Format: [x, y, z, vertexType]
		// vertexType: 0=Static Body, 1=Left Wing Tip (Flap), 2=Right Wing Tip (Flap)
		const triangles = [
			// Body Top
			[0, 0, -10, 0],
			[1.5, 0, -2, 0],
			[0, 2, 0, 0], // Head, R-Shoulder, Top
			[0, 0, -10, 0],
			[0, 2, 0, 0],
			[-1.5, 0, -2, 0], // Head, Top, L-Shoulder
			[1.5, 0, -2, 0],
			[0, 0, 5, 0],
			[0, 2, 0, 0], // R-Shoulder, TailRoot, Top
			[-1.5, 0, -2, 0],
			[0, 2, 0, 0],
			[0, 0, 5, 0], // L-Shoulder, Top, TailRoot
			// Body Bottom (Darker usually)
			[0, 0, -10, 0],
			[0, -1, 0, 0],
			[1.5, 0, -2, 0], // Head, Bottom, R-Shoulder
			[0, 0, -10, 0],
			[-1.5, 0, -2, 0],
			[0, -1, 0, 0], // Head, L-Shoulder, Bottom
			[1.5, 0, -2, 0],
			[0, -1, 0, 0],
			[0, 0, 5, 0], // R-Shoulder, Bottom, TailRoot
			[-1.5, 0, -2, 0],
			[0, 0, 5, 0],
			[0, -1, 0, 0], // L-Shoulder, TailRoot, Bottom
			// Wings (Connected to Shoulder and TailRoot/Offset)
			// Left Wing
			[-1.5, 0, -2, 0],
			[-18, 0, 0, 1],
			[-1.5, 0, 4, 0], // Shoulder, Tip, NearTail
			// Right Wing
			[1.5, 0, -2, 0],
			[1.5, 0, 4, 0],
			[18, 0, 0, 2], // Shoulder, NearTail, Tip
			// Tail
			[0, 0, 5, 0],
			[0, 0, 12, 0],
			[0, 1, 5, 0], // Root, Tip, TopRoot(Thick) - simplified flat tail
		]
		// Total vertices per bird
		const vertsPerBird = triangles.length
		const totalVertices = birdsCount * vertsPerBird

		const vertices = new THREE.BufferAttribute(
			new Float32Array(totalVertices * 3),
			3,
		)
		const birdColors = new THREE.BufferAttribute(
			new Float32Array(totalVertices * 3),
			3,
		)
		const references = new THREE.BufferAttribute(
			new Float32Array(totalVertices * 2),
			2,
		)
		const birdVertex = new THREE.BufferAttribute(
			new Float32Array(totalVertices),
			1,
		)
		this.setAttribute("position", vertices)
		this.setAttribute("birdColor", birdColors)
		this.setAttribute("reference", references)
		this.setAttribute("birdVertex", birdVertex)

		let v = 0
		for (let f = 0; f < birdsCount; f++) {
			const x = (f % width) / width
			const y = ~~(f / width) / width

			const cBase = new THREE.Color(0xff2200) // Base Red
			// Add slight randomness to color
			cBase.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1)
			for (let t = 0; t < triangles.length; t++) {
				const vertData = triangles[t]

				// Position
				vertices.array[v * 3 + 0] = vertData[0]
				vertices.array[v * 3 + 1] = vertData[1]
				vertices.array[v * 3 + 2] = vertData[2]
				// Vertex Type (Animation flag)
				const vType = vertData[3]
				birdVertex.array[v] = vType
				// Reference (UV for GPGPU lookup)
				references.array[v * 2] = x
				references.array[v * 2 + 1] = y
				// Color Logic ------------------------------------------------
				// Celestial / Seagull Theme for Visibility on Dark Background

				const finalColor = new THREE.Color()

				if (vType === 1 || vType === 2) {
					// Wing Tips (Cyan/Blue - Distinct from body)
					finalColor.setHex(0x00ccff)
					// Add some purple/blue variance to wings
					finalColor.offsetHSL(Math.random() * 0.1, 0, 0)
				} else if (vertData[1] < -0.1) {
					// Belly (Light Grey Shadow - not too dark)
					finalColor.setHex(0xaaaaaa)
				} else if (vertData[2] > 8) {
					// Tail (Deep Blue)
					finalColor.setHex(0x2244ff)
				} else {
					// Body / Head (White/Very Light Grey - Primary visibility source)
					finalColor.setHex(0xffffff)
				}

				// Unified randomness
				// Slightly vary brightness to keep them feeling organic/shimmering
				finalColor.multiplyScalar(1.0 - Math.random() * 0.2)
				birdColors.array[v * 3 + 0] = finalColor.r
				birdColors.array[v * 3 + 1] = finalColor.g
				birdColors.array[v * 3 + 2] = finalColor.b
				v++
			}
		}
		this.scale(0.2, 0.2, 0.2)
	}
}

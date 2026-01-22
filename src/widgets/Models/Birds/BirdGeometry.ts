import * as THREE from "three/webgpu"

export class BirdGeometry extends THREE.BufferGeometry {
    constructor() {
        super()

        // --- 새의 형태 정의 (Triangles) ---
        // Format: [x, y, z, vertexType]
        // vertexType: 0=몸통(고정), 1=왼쪽 날개(애니메이션), 2=오른쪽 날개(애니메이션)
        const triangles = [
            // Body Top
            [0, 0, -10, 0],
            [1.5, 0, -2, 0],
            [0, 2, 0, 0],
            [0, 0, -10, 0],
            [0, 2, 0, 0],
            [-1.5, 0, -2, 0],
            [0, 2, 0, 0],
            [0, 0, 5, 0],
            [-1.5, 0, -2, 0],
            [0, 2, 0, 0],
            [1.5, 0, -2, 0],
            [0, 0, 5, 0],
            // Body Bottom
            [0, 0, -10, 0],
            [0, -1, 0, 0],
            [1.5, 0, -2, 0],
            [0, 0, -10, 0],
            [-1.5, 0, -2, 0],
            [0, -1, 0, 0],
            [1.5, 0, -2, 0],
            [0, -1, 0, 0],
            [0, 0, 5, 0],
            [-1.5, 0, -2, 0],
            [0, 0, 5, 0],
            [0, -1, 0, 0],
            // Wings
            [-1.5, 0, -2, 0],
            [-18, 0, 0, 1],
            [-1.5, 0, 4, 0], // Left
            [1.5, 0, -2, 0],
            [1.5, 0, 4, 0],
            [18, 0, 0, 2], // Right
            // Tail
            [0, 0, 5, 0],
            [0, 0, 12, 0],
            [0, 1, 5, 0],
        ]

        const totalVertices = triangles.length
        const vertices = new Float32Array(totalVertices * 3)
        const birdColors = new Float32Array(totalVertices * 3)
        const birdVertex = new Float32Array(totalVertices)

        let v = 0
        for (let t = 0; t < triangles.length; t++) {
            const vertData = triangles[t]

            // Position
            vertices[v * 3 + 0] = vertData[0]
            vertices[v * 3 + 1] = vertData[1]
            vertices[v * 3 + 2] = vertData[2]

            // Type
            const vType = vertData[3]
            birdVertex[v] = vType

            // Color
            const finalColor = new THREE.Color()
            if (vType === 1 || vType === 2)
                finalColor.setHex(0x00ccff) // Wing
            else if (vertData[1] < -0.1)
                finalColor.setHex(0xaaaaaa) // Belly
            else if (vertData[2] > 8)
                finalColor.setHex(0x2244ff) // Tail
            else finalColor.setHex(0xffffff) // Body

            finalColor.multiplyScalar(1.0 - Math.random() * 0.2) // Random variance

            birdColors[v * 3 + 0] = finalColor.r
            birdColors[v * 3 + 1] = finalColor.g
            birdColors[v * 3 + 2] = finalColor.b

            v++
        }

        this.setAttribute("position", new THREE.BufferAttribute(vertices, 3))
        this.setAttribute("birdColor", new THREE.BufferAttribute(birdColors, 3))
        this.setAttribute(
            "birdVertex",
            new THREE.BufferAttribute(birdVertex, 1),
        )

        this.scale(0.2, 0.2, 0.2)
        this.computeVertexNormals()
    }
}

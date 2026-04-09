import type { Vector2, Vector3 } from "three/webgpu"

export interface IRaycastService {
    getIntersection(ndcPosition: Vector2, yHeight: number): Vector3 | null
}

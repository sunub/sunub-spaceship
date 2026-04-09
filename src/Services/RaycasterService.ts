import { inject, injectable } from "inversify"
import { Plane, Raycaster, type Vector2, Vector3 } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Camera } from "../Camera"
import type { IRaycastService } from "./IRaycastService"

@injectable()
export class RaycastService implements IRaycastService {
    private raycaster = new Raycaster()
    private workingPlane = new Plane(new Vector3(0, 1, 0), 0) // 기본 수평면

    constructor(@inject(GAME_CONTEXT.CORE.Camera) private camera: Camera) {}

    public getIntersection(
        ndcPosition: Vector2,
        yHeight: number,
    ): Vector3 | null {
        // 1. 카메라와 NDC 좌표를 이용해 레이 설정
        this.raycaster.setFromCamera(ndcPosition, this.camera.instance)

        // 2. 평면 높이 설정 (Plane constant는 원점으로부터의 거리이므로 -yHeight)
        // Plane의 법선이 (0, 1, 0)일 때, 점 P가 평면 위에 있으려면 dot(N, P) + constant = 0
        // 0*x + 1*y + 0*z + c = 0  => y = -c => c = -height
        this.workingPlane.constant = -yHeight

        // 3. 레이와 평면의 교차점을 찾음
        const target = new Vector3()
        const hit = this.raycaster.ray.intersectPlane(this.workingPlane, target)

        return hit ? target : null
    }
}

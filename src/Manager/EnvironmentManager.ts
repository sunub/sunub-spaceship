import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Scene } from "../core/Scene"
import { FixedNightFog } from "../Environment/Fog"

@injectable()
export class EnvironmentManager {
    public fog!: FixedNightFog
    private initialized = false

    constructor(
        @inject(GAME_CONTEXT.CORE.Scene)
        private readonly scene: Scene,
    ) {}

    /**
     * 안개와 조명 등 환경 요소를 설정합니다.
     * 멱등성 보장: 여러 번 호출되어도 한 번만 초기화됩니다.
     */
    public setup(): void {
        if (this.initialized) return
        this.fog = new FixedNightFog(this.scene)
        this.initialized = true
    }

    public dispose(): void {
        // 필요 시 구현
    }
}

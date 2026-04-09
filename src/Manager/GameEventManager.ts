import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Rendering } from "@/core/Rendering"
import type { Audio } from "@/Environment/Audio"
import type { Size } from "@/utils/Size"

@injectable()
export class GameEventManager {
    constructor(
        @inject(GAME_CONTEXT.UTILITY.Size) private size: Size,
        @inject(GAME_CONTEXT.CORE.Audio) private audio: Audio,
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
    ) {}

    public setupEvents() {
        this.size.on("resize", () =>
            this.rendering.resize({
                width: this.size.width,
                height: this.size.height,
                pixelRatio: this.size.pixelRatio,
            }),
        )
    }

    public setupVisibilityEvents() {
        document.addEventListener(
            "visibilitychange",
            this.handleVisibilityChange.bind(this),
        )
    }

    private handleVisibilityChange() {
        if (document.visibilityState === "hidden") {
            this.audio.systemMute(true)
        } else {
            this.audio.systemMute(false)
        }
    }
}

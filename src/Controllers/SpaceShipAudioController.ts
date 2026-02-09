import { inject, injectable } from "inversify";
import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { Audio, SoundName } from "@/Environment/Audio";

@injectable()
export class SpaceShipAudioController {
    constructor(
        @inject(GAME_CONTEXT.CORE.Audio) private readonly audio: Audio
    ) {}

    public updateEngineSound(isMoving: boolean): void {
        if (isMoving) {
            if (!this.audio.isPlaying("engine")) {
                this.audio.play("engine");
            }
        } else {
            if (this.audio.isPlaying("engine")) {
                this.audio.stop("engine");
            }
        }
    }

    public playSound(soundName: SoundName): void {
        this.audio.play(soundName);
    }
}

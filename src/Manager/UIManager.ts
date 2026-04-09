import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { InputIndicator } from "@/UI/InputIndicator"

@injectable()
export class UIManager {
    constructor(
        @inject(GAME_CONTEXT.UI.InputIndicator)
        private inputIndicator: InputIndicator,
    ) {}

    public setupUISystems() {
        this.inputIndicator.initialize()
    }
}

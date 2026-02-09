import { GAME_CONTEXT } from "@/core/DI/DITypes";
import { inject, injectable } from "inversify";
import { InputIndicator } from "@/UI/InputIndicator";

@injectable()
export class UIManager {
    constructor(
        @inject(GAME_CONTEXT.UI.InputIndicator)
        private inputIndicator: InputIndicator,
    ) {}

    public setupUISystems() {
        this.inputIndicator.initialize();
    }
}

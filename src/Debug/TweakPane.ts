import { Pane } from "tweakpane"
import type { PaneConfig } from "tweakpane/dist/types/pane/pane-config"

export class TweakPane extends Pane {
    private options: PaneConfig
    private static instance: TweakPane
    static getInstance(options?: PaneConfig): TweakPane {
        if (!TweakPane.instance) {
            TweakPane.instance = new TweakPane(options || {})
        }
        return TweakPane.instance
    }

    static isInitialized(): boolean {
        return TweakPane.instance !== null
    }

    constructor(options: PaneConfig) {
        super(options)
        this.options = options
    }

    get getOptions(): PaneConfig {
        return this.options
    }
}

import { Pane } from "tweakpane"

import type { PaneConfig } from "tweakpane/dist/types/pane/pane-config"

export class Debug {
    static instance: Pane | null = null

    constructor(options: PaneConfig) {
        if (!Debug.instance) {
            Debug.instance = new Pane(options)
        }
    }

    static getInstance(options: PaneConfig): Pane {
        if (!Debug.instance) {
            Debug.instance = new Pane(options)
        }
        return Debug.instance
    }
}

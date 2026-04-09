import { inject, injectable } from "inversify"
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { DOMManager } from "@/core/DOMManger"
import type { Size } from "../utils/Size"

@injectable()
export class CSSRenderer extends CSS2DRenderer {
    constructor(
        @inject(GAME_CONTEXT.UTILITY.Size) private size: Size,
        @inject(GAME_CONTEXT.MANAGER.DOMManager) private domManager: DOMManager,
    ) {
        super()

        this.setSize(this.size.width, this.size.height)
        this.domElement.style.position = "absolute"
        this.domElement.style.top = "0px"
        this.domElement.style.pointerEvents = "none"
        this.domManager.domElement.appendChild(this.domElement)
        this.setupEvents()
    }

    private setupEvents() {
        this.size.on("resize", () => {
            this.setSize(this.size.width, this.size.height)
        })
    }
}

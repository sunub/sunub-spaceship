import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js"
import { ServiceRegistry } from "../core/ServiceRegistry"
import type { Size } from "../utils/Size"

export class CSSRenderer extends CSS2DRenderer {
    private _size: Size
    private root: HTMLElement

    constructor() {
        super()

        const registry = ServiceRegistry.getInstance()
        this._size = registry.get<Size>("size")

        this.setSize(this._size.width, this._size.height)
        this.domElement.style.position = "absolute"
        this.domElement.style.top = "0px"
        this.domElement.style.pointerEvents = "none" // UI 통과 클릭 방지 (필요시 조정)

        const root = registry.get("domElement") as HTMLDivElement
        if (!root) {
            throw new Error("Root element with id 'root' not found")
        }
        this.root = root
        this.root.appendChild(this.domElement)

        this.setupEvents()
    }

    private setupEvents() {
        this._size.on("resize", () => {
            this.setSize(this._size.width, this._size.height)
        })
    }
}

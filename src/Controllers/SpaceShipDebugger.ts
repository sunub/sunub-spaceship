import { injectable } from "inversify"
import {
    ArrowHelper,
    AxesHelper,
    Group,
    type Object3D,
    Vector3,
} from "three/webgpu"
import { TweakPane } from "@/Debug/TweakPane"
import type { SpaceShipPositionDebugModule } from "../Models/SpaceShip/debug/SpaceShip.PositionDebug"
import type { SpaceShipVisualDebugModule } from "../Models/SpaceShip/debug/SpaceShip.VisualDebug"

@injectable()
export class SpaceShipDebugger {
    private _debugGroup: Group = new Group()
    private _debugMode: boolean = false
    private _debugNormalArrow: ArrowHelper | null = null

    public initialize(
        parent: Object3D,
        sensorDebugMesh: Object3D,
        positionModule: SpaceShipPositionDebugModule,
        visualModule: SpaceShipVisualDebugModule,
    ): void {
        this._debugGroup.name = "SpaceShipDebugVisuals"
        this._debugGroup.visible = false
        parent.add(this._debugGroup)

        this._debugGroup.add(sensorDebugMesh)

        const axesHelper = new AxesHelper(1.5)
        this._debugGroup.add(axesHelper)

        const rollHelper = new ArrowHelper(
            new Vector3(1, 0, 0),
            new Vector3(0, 0, 0),
            1.5,
            0xff0000,
        )
        const yawHelper = new ArrowHelper(
            new Vector3(0, 1, 0),
            new Vector3(0, 0, 0),
            1.5,
            0x00ff00,
        )
        const pitchHelper = new ArrowHelper(
            new Vector3(0, 0, 1),
            new Vector3(0, 0, 0),
            1.5,
            0x0000ff,
        )

        this._debugGroup.add(rollHelper)
        this._debugGroup.add(yawHelper)
        this._debugGroup.add(pitchHelper)

        this._debugNormalArrow = new ArrowHelper(
            new Vector3(0, 1, 0),
            new Vector3(0, 0, 0),
            1.0,
            0xffff00,
        )
        this._debugNormalArrow.visible = false
        // Normal Arrow는 씬 매니저에 직접 추가되어야 할 수도 있으나,
        // 현재는 구조 유지를 위해 별도 관리 로직만 유지

        this._setupTweakPane(positionModule, visualModule)
    }

    private _setupTweakPane(
        positionModule: SpaceShipPositionDebugModule,
        visualModule: SpaceShipVisualDebugModule,
    ): void {
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get("debug") !== "spaceship") return

        this.setDebugMode(true)
        const pane = TweakPane.getInstance()
        const f = pane.addFolder({
            title: "SpaceShip Debug Controls",
            expanded: true,
        })

        const PARAMS = { debugMode: this._debugMode }
        f.addBinding(PARAMS, "debugMode", { label: "Show Visuals" }).on(
            "change",
            (ev) => {
                this.setDebugMode(ev.value)
            },
        )

        positionModule.setupDebugControls(f)
        visualModule.setupDebugControls(f)
    }

    public setDebugMode(isEnabled: boolean): void {
        this._debugMode = isEnabled
        this._debugGroup.visible = isEnabled
        if (this._debugNormalArrow) this._debugNormalArrow.visible = isEnabled
    }

    public get debugGroup(): Group {
        return this._debugGroup
    }
    public get debugMode(): boolean {
        return this._debugMode
    }
    public get debugNormalArrow(): ArrowHelper | null {
        return this._debugNormalArrow
    }
}

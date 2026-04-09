import { inject, injectable } from "inversify"
import type { Object3D, Vector2, Vector3 } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { InputManager } from "@/Inputs/InputManager"
import type { ISceneManager } from "@/Services/ISceneManager"
import type { JoyStick } from "./JoyStick"

export interface SpaceShipControlState {
    thrust: number
    roll: number
    pointerVector: Vector2 | null
    isActionActive: boolean
}

@injectable()
export class SpaceShipInputHandler {
    constructor(
        @inject(GAME_CONTEXT.MANAGER.InputManager)
        private readonly inputManager: InputManager,
        @inject(GAME_CONTEXT.CONTROLLER.JoyStick)
        private readonly joyStick: JoyStick,
    ) {}

    public initialize(modelMesh: Object3D, sceneManager: ISceneManager): void {
        const joystick = this.joyStick.drawJoyStick(modelMesh)
        if (joystick) {
            sceneManager.add(joystick)
        }
    }

    public getControlState(
        deltaTime: number,
        shipPosition: Vector3,
    ): SpaceShipControlState {
        // 조이스틱 업데이트
        this.joyStick.update(deltaTime, shipPosition)

        // 키보드 입력 처리
        const thrustInput =
            (this.inputManager.isAction("MoveForward") ? 1 : 0) +
            (this.inputManager.isAction("MoveBackward") ? -1 : 0)
        const rollInput =
            (this.inputManager.isAction("TurnLeft") ? -1 : 0) +
            (this.inputManager.isAction("TurnRight") ? 1 : 0)

        const isKeyboardActive =
            Math.abs(thrustInput) > 0.1 || Math.abs(rollInput) > 0.1

        let pointerVector: Vector2 | null = null
        if (!isKeyboardActive) {
            pointerVector = this.joyStick.outputVector
        }

        const isActionActive =
            Math.abs(thrustInput) > 0 ||
            Math.abs(rollInput) > 0 ||
            (pointerVector !== null &&
                (Math.abs(pointerVector.x) > 0 ||
                    Math.abs(pointerVector.y) > 0))

        return {
            thrust: thrustInput,
            roll: rollInput,
            pointerVector: pointerVector,
            isActionActive: isActionActive,
        }
    }
}

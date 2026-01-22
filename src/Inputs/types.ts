export type KeyboardKeys =
    | "Enter"
    | "Escape"
    | "Space"
    | "ArrowUp"
    | "ArrowDown"
    | "ArrowLeft"
    | "ArrowRight"
    | "Tab"
    | "ShiftLeft"
    | "ShiftRight"
    | "ControlLeft"
    | "ControlRight"
    | "AltLeft"
    | "AltRight"
    | "KeyW"
    | "KeyA"
    | "KeyS"
    | "KeyD"
    | "KeyQ"
    | "KeyE"
    | "Digit1"
    | "Digit2"
    | "Digit3"
    | "Digit4"
    | "Digit5"

export type ActionType =
    | "MoveForward"
    | "MoveBackward"
    | "TurnLeft"
    | "TurnRight"
    | "Interact"

export type InputConfig = Record<ActionType, KeyboardKeys[]>

export type InputMap = {
    name: string
    keys: KeyboardKeys[]
}

export type InputMaps = InputMap[]

// 새로운 아키텍처를 위한 타입들
export interface Vector2 {
    x: number
    y: number
}

// 입력 이벤트 데이터 타입들
export interface InputEventData {
    key?: {
        code: KeyboardKeys
        pressed: boolean
        timestamp: number
    }
    vector2?: {
        name: string
        value: Vector2
        timestamp: number
    }
    action?: {
        name: string
        value: any
        timestamp: number
    }
}

// 입력 프로세서 인터페이스
export interface IInputProcessor {
    readonly name: string
    process(rawInputs: Map<KeyboardKeys, boolean>): any
    dispose?(): void
}

// 액션 매퍼 인터페이스
export interface IActionMapper {
    readonly name: string
    map(processedInput?: any): any
    dispose?(): void
}

// 플레이어 비행 액션 타입
export interface FlightActions {
    movement: Vector2
    boost: boolean
    accelerate: number
    pitch: number
}

// 카메라 컨트롤 액션 타입
export interface CameraActions {
    modeSwitch: number | null
}

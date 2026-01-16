// 새로운 Input 시스템 내보내기
export { InputManager } from "./InputManager"
// 기존 Inputs 클래스도 계속 내보내기 (하위 호환성)
export { Inputs } from "./index"
export { FlightActionMapper } from "./mappers/FlightActionMapper"
export { Vector2Processor } from "./processors/Vector2Processor"
// 타입들 내보내기
export type {
    FlightActions,
    IActionMapper,
    IInputProcessor,
    InputEventData,
    InputMap,
    InputMaps,
    KeyboardKeys,
    Vector2,
} from "./types"

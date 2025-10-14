// 새로운 Input 시스템 내보내기
export { InputManager } from './InputManager';
export { Vector2Processor } from './processors/Vector2Processor';
export { FlightActionMapper } from './mappers/FlightActionMapper';

// 타입들 내보내기
export type { 
  KeyboardKeys, 
  InputMap, 
  InputMaps, 
  Vector2, 
  InputEventData, 
  IInputProcessor, 
  IActionMapper, 
  FlightActions 
} from './types';

// 기존 Inputs 클래스도 계속 내보내기 (하위 호환성)
export { Inputs } from './index';

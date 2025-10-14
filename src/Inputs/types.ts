export type KeyboardKeys = 'Enter' | 'Escape' | 'Space' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Tab' | 'ShiftLeft' | 'ShiftRight' | 'ControlLeft' | 'ControlRight' | 'AltLeft' | 'AltRight' | 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' | 'KeyQ' | 'KeyE';

export type InputMap = {
  name: string;
  keys: KeyboardKeys[];
}

export type InputMaps = InputMap[];

// 새로운 아키텍처를 위한 타입들
export interface Vector2 {
  x: number;
  y: number;
}

// 입력 이벤트 데이터 타입들
export interface InputEventData {
  key?: {
    code: KeyboardKeys;
    pressed: boolean;
    timestamp: number;
  };
  vector2?: {
    name: string;
    value: Vector2;
    timestamp: number;
  };
  action?: {
    name: string;
    value: any;
    timestamp: number;
  };
}

// 입력 프로세서 인터페이스
export interface IInputProcessor {
  readonly name: string;
  process(rawInputs: Map<KeyboardKeys, boolean>): any;
  dispose?(): void;
}

// 액션 매퍼 인터페이스  
export interface IActionMapper {
  readonly name: string;
  map(processedInput?: any): any;
  dispose?(): void;
}

// 플레이어 비행 액션 타입
export interface FlightActions {
  movement: Vector2;      // A/D: 좌우 회전, W/S: 전진/후진
  boost: boolean;         // Shift: 부스트
  accelerate: number;     // Q/E: 속도 감소/증가 (-1, 0, 1)
  pitch: number;          // 상하 피치 제어 (향후 마우스나 다른 키로 제어 예정)
}

import type { IInputProcessor, KeyboardKeys, Vector2 } from '../types';

export class Vector2Processor implements IInputProcessor {
  readonly name: string;
  private config: {
    upKey: KeyboardKeys;
    downKey: KeyboardKeys;
    leftKey: KeyboardKeys;
    rightKey: KeyboardKeys;
  };
  private lastVector: Vector2 = { x: 0, y: 0 };

  constructor(name: string, config: {
    upKey: KeyboardKeys;
    downKey: KeyboardKeys; 
    leftKey: KeyboardKeys;
    rightKey: KeyboardKeys;
  }) {
    this.name = name;
    this.config = config;
  }

  process(rawInputs: Map<KeyboardKeys, boolean>): Vector2 | undefined {
    const up = rawInputs.get(this.config.upKey) || false;
    const down = rawInputs.get(this.config.downKey) || false;
    const left = rawInputs.get(this.config.leftKey) || false;
    const right = rawInputs.get(this.config.rightKey) || false;

    const x = (left ? -1 : 0) + (right ? 1 : 0);
    const y = (down ? -1 : 0) + (up ? 1 : 0);

    const newVector: Vector2 = { x, y };

    // 값이 변경된 경우만 반환
    if (newVector.x !== this.lastVector.x || newVector.y !== this.lastVector.y) {
      this.lastVector = newVector;
      return newVector;
    }

    return undefined; // 변경사항 없음
  }

  // 현재 Vector2 값 조회 (변경 여부와 상관없이)
  getCurrentVector(rawInputs: Map<KeyboardKeys, boolean>): Vector2 {
    const up = rawInputs.get(this.config.upKey) || false;
    const down = rawInputs.get(this.config.downKey) || false;
    const left = rawInputs.get(this.config.leftKey) || false;
    const right = rawInputs.get(this.config.rightKey) || false;

    return {
      x: (left ? -1 : 0) + (right ? 1 : 0),
      y: (down ? -1 : 0) + (up ? 1 : 0)
    };
  }

  dispose(): void {
    // 정리 작업이 필요한 경우 여기에 구현
  }
}

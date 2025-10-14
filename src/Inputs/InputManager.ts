import EventEmitter from '../utils/EventEmitter';
import type { KeyboardKeys, IInputProcessor, IActionMapper, InputEventData } from './types';

export class InputManager extends EventEmitter {
  private static instance: InputManager;
  private rawInputs = new Map<KeyboardKeys, boolean>();
  private processors = new Map<string, IInputProcessor>();
  private actionMappers = new Map<string, IActionMapper>();
  private isEnabled = true;

  constructor() {
    super();
    this.setupEventListeners();
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  // 프로세서 등록 (Vector2, 조합키 등)
  addProcessor(processor: IInputProcessor): this {
    this.processors.set(processor.name, processor);
    return this;
  }

  // 액션 매퍼 등록 (게임 액션 매핑)
  addActionMapper(mapper: IActionMapper): this {
    this.actionMappers.set(mapper.name, mapper);
    return this;
  }

  // 프로세서 제거
  removeProcessor(name: string): this {
    const processor = this.processors.get(name);
    processor?.dispose?.();
    this.processors.delete(name);
    return this;
  }

  // 액션 매퍼 제거
  removeActionMapper(name: string): this {
    const mapper = this.actionMappers.get(name);
    mapper?.dispose?.();
    this.actionMappers.delete(name);
    return this;
  }

  // 활성화/비활성화
  setEnabled(enabled: boolean): this {
    this.isEnabled = enabled;
    return this;
  }

  // Raw 입력 상태 조회
  isKeyPressed(key: KeyboardKeys): boolean {
    return this.rawInputs.get(key) || false;
  }

  // 모든 Raw 입력 상태 조회
  getRawInputs(): Map<KeyboardKeys, boolean> {
    return new Map(this.rawInputs);
  }

  // 메인 업데이트 루프 (Game.ts에서 호출)
  update(): void {
    if (!this.isEnabled) return;

    // 1. 프로세서들 실행
    this.processors.forEach((processor) => {
      try {
        const result = processor.process(this.rawInputs);
        if (result !== undefined) {
          this.trigger(`input.${processor.name}`, result);
        }
      } catch (error) {
        console.warn(`Error in processor ${processor.name}:`, error);
      }
    });

    // 2. 액션 매퍼들 실행
    this.actionMappers.forEach((mapper) => {
      try {
        const result = mapper.map();
        if (result !== undefined) {
          this.trigger(`action.${mapper.name}`, result);
        }
      } catch (error) {
        console.warn(`Error in action mapper ${mapper.name}:`, error);
      }
    });
  }

  private setupEventListeners(): void {
    addEventListener('keydown', (event) => {
      if (!this.isEnabled) return;
      
      const key = event.code as KeyboardKeys;
      const wasPressed = this.rawInputs.get(key) || false;
      
      this.rawInputs.set(key, true);
      
      // 키 다운 이벤트 발행 (처음 눌렸을 때만)
      if (!wasPressed) {
        this.trigger('input.keydown', {
          key: {
            code: key,
            pressed: true,
            timestamp: Date.now()
          }
        } as InputEventData);
      }
    });

    addEventListener('keyup', (event) => {
      if (!this.isEnabled) return;
      
      const key = event.code as KeyboardKeys;
      this.rawInputs.set(key, false);
      
      // 키 업 이벤트 발행
      this.trigger('input.keyup', {
        key: {
          code: key,
          pressed: false,
          timestamp: Date.now()
        }
      } as InputEventData);
    });

    // 포커스 잃을 때 모든 키 해제
    addEventListener('blur', () => {
      this.rawInputs.forEach((_, key) => {
        this.rawInputs.set(key, false);
      });
    });
  }

  // 디버깅용 메서드들
  getProcessorNames(): string[] {
    return Array.from(this.processors.keys());
  }

  getActionMapperNames(): string[] {
    return Array.from(this.actionMappers.keys());
  }

  getPressedKeys(): KeyboardKeys[] {
    const pressed: KeyboardKeys[] = [];
    this.rawInputs.forEach((isPressed, key) => {
      if (isPressed) pressed.push(key);
    });
    return pressed;
  }

  dispose(): void {
    this.processors.forEach(processor => processor.dispose?.());
    this.actionMappers.forEach(mapper => mapper.dispose?.());
    this.processors.clear();
    this.actionMappers.clear();
    this.rawInputs.clear();
    this.removeAllListeners();
  }
}

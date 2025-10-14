import type { InputMaps, KeyboardKeys } from "./types";
import { InputManager } from "./InputManager";

export class Inputs {
  private _registerdKeys = new Map<KeyboardKeys, boolean>();
  private inputManager: InputManager;

  constructor(_map: InputMaps) {
    // 기존 방식으로 키 등록
    for(const { keys } of _map) {
      this._registerdKeys.set(keys[0], false);
    }

    // 새로운 InputManager와 연결
    this.inputManager = InputManager.getInstance();
    this.setupInputManagerListeners();

    // 기존 이벤트 리스너 유지 (하위 호환성)
    addEventListener('keydown', (_event) => {
      this.down(_event.code);
    });

    addEventListener('keyup', (_event) => {
      this.up(_event.code);
    });
  }

  private setupInputManagerListeners(): void {
    // InputManager의 키 이벤트를 구독하여 기존 방식 업데이트
    this.inputManager.on('input.keydown', (data: any) => {
      if (this._registerdKeys.has(data.key.code)) {
        this._registerdKeys.set(data.key.code, true);
      }
    });

    this.inputManager.on('input.keyup', (data: any) => {
      if (this._registerdKeys.has(data.key.code)) {
        this._registerdKeys.set(data.key.code, false);
      }
    });
  }

  down(keyCode: string) {
    if(this._registerdKeys.has(keyCode as KeyboardKeys)) {
      this._registerdKeys.set(keyCode as KeyboardKeys, true);
    }
  }

  up(keyCode: string) {
    if(this._registerdKeys.has(keyCode as KeyboardKeys)) {
      this._registerdKeys.set(keyCode as KeyboardKeys, false);
    }
  }

  // 새로운 메서드: 키 상태 조회
  isPressed(keyCode: KeyboardKeys): boolean {
    return this._registerdKeys.get(keyCode) || false;
  }

  // 새로운 메서드: InputManager 접근
  getInputManager(): InputManager {
    return this.inputManager;
  }

  // 정리 메서드
  dispose(): void {
    this.inputManager.off('input.keydown');
    this.inputManager.off('input.keyup');
  }
}

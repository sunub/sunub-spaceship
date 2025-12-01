import type { IActionMapper, KeyboardKeys, CameraActions } from "../types";
import { InputManager } from "../InputManager";

export class CameraActionMapper implements IActionMapper {
  readonly name = 'camera';
  private inputManager: InputManager;

  private keyToCameraModeMap: Record<KeyboardKeys, number> = {
    'Digit2': 2, // FOLLOW mode only
  } as Record<KeyboardKeys, number>;

  constructor() {
    this.inputManager = InputManager.getInstance();
  }

  map(): CameraActions {
    let modeSwitch: number | null = null;

    // 카메라 모드 전환 키 체크 (1-5)
    for (const [key, mode] of Object.entries(this.keyToCameraModeMap)) {
      if (this.inputManager.isKeyPressed(key as KeyboardKeys)) {
        modeSwitch = mode;
        break; // 첫 번째 눌린 키만 처리
      }
    }

    return {
      modeSwitch
    };
  }

  dispose(): void {
    // 필요한 경우 정리 작업
  }
}

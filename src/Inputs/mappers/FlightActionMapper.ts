import type { IActionMapper, FlightActions, Vector2 } from '../types';
import { InputManager } from '../InputManager';

export class FlightActionMapper implements IActionMapper {
  readonly name = 'flight';
  private inputManager: InputManager;
  private lastActions: FlightActions = {
    movement: { x: 0, y: 0 },
    boost: false,
    accelerate: 0,
    pitch: 0
  };

  constructor() {
    this.inputManager = InputManager.getInstance();
  }

  map(): FlightActions {
    const movement = this.getMovementInput();
    const boost = this.getBoostInput();
    const accelerate = this.getAccelerateInput();
    const pitch = this.getPitchInput();

    const actions: FlightActions = { movement, boost, accelerate, pitch };
    
    // 변경사항이 있을 때만 새로운 객체 생성 및 캐시 업데이트
    if (this.hasChanged(actions)) {
      this.lastActions = { ...actions };
      return actions;
    }

    // 변경사항이 없으면 undefined 반환 (이벤트 발행 안함)
    return undefined as any;
  }

  // 현재 액션 상태 조회 (변경 여부와 상관없이)
  getCurrentActions(): FlightActions {
    return {
      movement: this.getMovementInput(),
      boost: this.getBoostInput(),
      accelerate: this.getAccelerateInput(),
      pitch: this.getPitchInput()
    };
  }

  private getMovementInput(): Vector2 {
    // WS 키를 전진/후진으로, AD 키를 좌우 회전으로 사용
    const forward = this.inputManager.isKeyPressed('KeyW');  // 전진
    const backward = this.inputManager.isKeyPressed('KeyS'); // 후진
    const left = this.inputManager.isKeyPressed('KeyA');     // 좌회전
    const right = this.inputManager.isKeyPressed('KeyD');    // 우회전

    return {
      x: (left ? -1 : 0) + (right ? 1 : 0),        // 좌우 회전
      y: (backward ? -1 : 0) + (forward ? 1 : 0)    // 전진/후진
    };
  }

  private getBoostInput(): boolean {
    // Shift 키 확인 (왼쪽/오른쪽 둘 다 지원)
    return this.inputManager.isKeyPressed('ShiftLeft') || 
           this.inputManager.isKeyPressed('ShiftRight');
  }

  private getAccelerateInput(): number {
    // Q (감속) / E (가속) 키 확인
    const speedDown = this.inputManager.isKeyPressed('KeyQ');
    const speedUp = this.inputManager.isKeyPressed('KeyE');
    return (speedDown ? -1 : 0) + (speedUp ? 1 : 0);
  }

  private getPitchInput(): number {
    // 향후 마우스나 다른 키로 피치 제어 계획
    // 현재는 0으로 고정 (피치 제어 없음)
    return 0;
  }

  private hasChanged(newActions: FlightActions): boolean {
    return (
      newActions.movement.x !== this.lastActions.movement.x ||
      newActions.movement.y !== this.lastActions.movement.y ||
      newActions.boost !== this.lastActions.boost ||
      newActions.accelerate !== this.lastActions.accelerate ||
      newActions.pitch !== this.lastActions.pitch
    );
  }

  dispose(): void {
    // 필요한 경우 정리 작업
  }
}

# 구조 개선 - 런타임 에러 해결 및 입력 시스템(Input System) 정상화

## 목표 설명 (Goal Description)
`Game.ts`의 런타임 에러(`Notification` 미초기화)를 수정하고, `JoyStick`의 드래그 로직 오류와 `InputManager`의 키보드 이벤트 미수신 문제를 해결하여 우주선 조작을 정상화합니다. 브라우저의 전역 객체인 `window` 대신 Canvas 요소를 포커스 가능하게 만들어 시스템의 안정성을 확보합니다.

## 제안된 변경 사항 (Proposed Changes)

### [Core: DOMManger.ts]
- **Canvas Focusability**: `canvas` 요소에 `tabIndex = 0` 속성을 부여하여 포커스 가능 상태로 설정.
    - 이를 통해 `window` 객체를 오염시키지 않고, `InputManager`가 `canvas`에 부착한 이벤트 리스너가 키보드 입력을 즉시 수신하도록 설계 변경.

### [Widgets: Game.ts]
- **초기화 순서 조정**: `setupEnvironment()` 메서드에서 `Notification`과 `TerminalOverlay` 인스턴스가 `IGameContext` 준비 후 즉시 초기화되도록 수정하여 런타임 전역 에러(undefined access) 방지.

### [Widgets: JoyStick.ts]
- **드래그 로직 수정**: `InputManager`의 `getPointerState()`와 동기화하여 드래그 시작/종료 시점의 입력 벡터가 비정상적으로 튀는 현상 수정.

## 검증 계획 (Verification Plan)
1. **초기화 확인**: 게임 로딩 후 콘솔에 에러("Notification is undefined")가 없는지 확인.
2. **키보드 조작**: 캔버스 클릭 전후로 `W`, `A`, `S`, `D` 키와 조이스틱을 사용했을 때 우주선이 의도대로 조종되는가?
3. **입력 상태 일관성**: 마우스 드래그와 키보드 입력을 혼용했을 때 입력 상태가 꼬이지 않고 부드럽게 전환되는가?

# 구현 계획 - 우주선 전방 충돌 방지 시스템 (Raycaster)

## 목표 설명 (Goal Description)
우주선 비행 중 전방의 장애물을 미리 감지(Raycaster)하여, 실제 물리적 충돌이 발생하기 전에 추진력을 제어(FlightController)합니다. 이를 통해 벽에 비빌 때 발생하는 물리적 떨림(Jitter) 현상을 원천 차단하고 보행/비행 경험을 부드럽게 개선하는 것이 목표입니다.

## 기술 분석 (Technical Analysis)
- **문제점**: 물리 엔진의 이벤트 큐(`EventQueue`)는 충돌 *후*의 상황을 처리하므로 충돌 당시의 떨림을 막기 어려움.
- **해결책**: **Raycaster(예방형)** 방식을 통해 충돌 전 탐지 및 컨트롤러 연동.
- **작동 원리**:
    - 우주선 정면 방향으로 5m 거리의 검사 광선 발사.
    - 장애물 탐지 시 `isObstacle` 플래그 설정 및 디버그용 `ArrowHelper` 색상 변경(노랑 -> 빨강).

## 제안된 변경 사항 (Proposed Changes)

### [MODIFY] `src/widgets/Models/SpaceShip/model/SpaceShip.ts`
- `THREE.Raycaster` 및 `ArrowHelper` 인스턴스 멤버 추가.
- `updateRaycast()` 메서드 구현:
    - 우주선의 위치와 `getWorldDirection()`을 기반으로 광선의 시작점과 방향 업데이트.
    - `intersectObjects(scene.children)`를 통해 장애물과의 거리 체크.
- `updateFlightController()`에서 제어 입력을 조건부 수정:
    - 전방이 차단된 경우(`isObstacle`) 전진 입력(`thrust > 0`)만 0으로 고정.
    - 후진(`thrust < 0`) 및 회전(Roll, Yaw)은 허용하여 탈출 가능하게 설계.

### [MODIFY] `src/widgets/controllers/FlightController.ts`
- 조이스틱/포인터 입력 시에도 충돌 상태를 반영할 수 있도록 `updatePointerInput()` 메서드 확장.
- `thrustEnabled` 플래그를 통해 실제 물리 힘을 계산하기 전에 가속력 차단.

## 검증 계획 (Verification Plan)
1. **시각적 검증**: 화살표의 색상이 장애물 앞에서 정확히 빨간색으로 변하는가?
2. **동작 검증**: 벽에 정면으로 비빌 때 우주선이 관통하거나 떨리지 않고 멈추는가?
3. **탈출 검증**: 벽에 막힌 상태에서 후진('S'키 또는 조이스틱 뒤쪽)을 통해 원활히 빠져나올 수 있는가?

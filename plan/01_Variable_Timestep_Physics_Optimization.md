# 구현 계획 - 가변 타임스텝 물리 (Variable Timestep Physics)

## 목표 설명 (Goal Description)
게임 루프를 기존의 고정 타임스텝(누적 및 보간 방식)에서 **델타 타임 제한(Delta Capping)을 적용한 가변 타임스텝** 방식으로 전환합니다. 이는 저사양 기기에서 물리 시뮬레이션과 화면 렌더링을 1:1로 동기화하여 시각적 끊김(Stuttering)과 물리 연산 과부하(Death Spiral)를 방지하기 위함이며, 참조 프로젝트인 `folio-2025`의 아키텍처와 일치시킵니다.

## 사용자 검토 필요 사항 (User Review Required)
> [!NOTE]
> 이 변경 사항이 적용되면 FPS가 매우 낮은 환경(20FPS 미만)에서는 게임 속도가 실제 시간보다 느려질 수 있습니다(슬로우 모션). 이는 기기가 멈추는 현상을 방지하기 위한 의도된 동작입니다.

## 제안된 변경 사항 (Proposed Changes)

### 핵심 시스템 (Core System)
#### [MODIFY] `src/widgets/Game.ts`
- `physicsAccumulator`, `FIXED_TIME_STEP`, `MAX_FRAME_TIME` 속성을 제거합니다.
- `physicsAlpha` getter를 제거합니다.
- `update()` 메서드 수정:
    - `time.delta`로부터 `delta`를 계산합니다. **중요: `this.time.delta * 0.001`을 하여 밀리초를 초 단위로 변환합니다.**
    - 델타 제한 적용: `Math.min(delta, 0.05)` (최소 20FPS 보장).
    - `obj.updatePhysics(delta)` 호출.
    - `physics.world.timestep = delta` 설정.
- **Camera 수정**:
    - `Camera.ts`의 `tick` 이벤트 리스너 제거 (`initialize`, `setupPan`, `setupZoom` 내부).
    - `Camera.ts`에 `update(deltaTime)` 메서드 추가.
        - **[최적화] `transitionTo`의 GSAP 의존성 제거 및 수동 보간 구현**:
            - `GSAP Ticker`와 `Game Loop`의 비동기화로 인한 성능 저하 방지.
            - `Camera` 내부에 `TransitionState` 관리 로직 추가.
        - `updateFollow(deltaTime)`, `updateOrbit(deltaTime)`, `updatePan(deltaTime)`, `updateZoom(deltaTime)` 등으로 로직 분리 및 통합.
        - Frame-rate independent lerp 적용: `alpha = 1 - Math.pow(1 - baseFactor, deltaTime * 60)`.
    - `Game.ts`의 `update` 루프에서 `gameObjects.update` 이후 `camera.update(deltaTime)` 호출.
    - `physics.step()` 호출.
    - `obj.update(delta)` 호출.

#### [MODIFY] `src/widgets/Physics.ts`
- `step()` 메서드가 `timestep` 인자를 선택적으로 받을 수 있도록 수정합니다.
- `timestep`이 제공되면 `this.world.timestep = timestep`으로 설정합니다.

#### [MODIFY] `src/core/GameContext.ts`
- `IGameObject` 인터페이스의 `fixedUpdate`를 `updatePhysics(deltaTime: number): void`로 변경합니다.

### 게임 오브젝트 (Game Objects)
#### [MODIFY] `src/widgets/Models/SpaceShip/model/SpaceShip.ts`
- `previousPosition`, `previousRotation` 및 `update` 내의 보간 로직을 모두 제거합니다.
- `fixedUpdate` 메서드명을 `updatePhysics`로 변경합니다.
- `updatePhysics` 내에서 `updateShapecast`와 `flightController` 호출을 유지합니다.
- `update`에서는 시각적 동기화(visual sync)만 유지합니다.

## 검증 계획 (Verification Plan)

### 수동 검증 (Manual Verification)
1.  **저사양 시뮬레이션 (Low FPS Simulation)**:
    - Chrome 개발자 도구 -> Performance 탭 -> CPU Throttling을 4x 또는 6x로 설정합니다.
    - 게임을 플레이하며 우주선의 움직임을 관찰합니다.
    - **예상 결과**: 움직임이 부드러워야 하며(끊김 없음), 20FPS 미만으로 떨어질 경우 게임 속도가 느려질 수 있지만(슬로우 모션), 멈췄다 가는 현상은 없어야 합니다.
2.  **정상 플레이 (Normal Play)**:
    - 스로틀링을 끄고 60FPS 이상에서 우주선이 정상적으로 동작하는지 확인합니다.
3.  **탭 전환 (Tab Switch)**:
    - 탭을 나갔다 들어올 때 물리 엔진이 폭주(우주선이 튀어 나가는 현상)하지 않는지 확인합니다 (`Time.reset` 및 델타 제한 덕분에 안정적이어야 함).

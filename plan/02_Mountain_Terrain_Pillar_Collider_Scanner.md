# 구현 계획 - 산(Mountain) 지형 기둥형 충돌체 최적화

## 목표 설명 (Goal Description)
기존의 무겁고 부정확한 `Trimesh` 방식의 충돌체 대신, 산 지형의 높이 데이터를 스캔하여 다수의 원기둥(Cylinder) 충돌체를 생성하는 **기둥 숲(Pillar Forest)** 방식의 충돌체를 구현합니다. 이는 물리 연산 성능을 확보하면서도 우주선이 지형과 자연스럽게 상호작용하도록 돕습니다.

## 기술 분석 (Technical Analysis)
- **Trimesh**: 메시의 모든 삼각형을 충돌체로 사용. 정밀하지만 연산 비용이 매우 높고 떨림 현상의 원인이 됨.
- **Pillar Forest (Raycasting)**: 특정 그리드 간격으로 위에서 아래로 레이저를 쏴서 지형의 높이를 측정하고, 해당 위치에 최적화된 원기둥 충돌체를 배치.
    - **장점**: 물리 엔진(Rapier)이 처리하기 가장 쉬운 기하학적 형태(원기둥)를 사용하여 성능 최적화.

## 제안된 변경 사항 (Proposed Changes)

### [MODIFY] `src/widgets/Models/Mountain/Mountain.ts`
- `createPhysicsBody()` 메서드 수정:
    - 산 모델의 바운딩 박스를 기준으로 그리드(예: 10x10) 생성.
    - 각 그리드 포인트에서 `Raycaster`를 사용하여 지형 메시와 교차점(높이) 확인.
    - 측정된 높이만큼의 길이를 가진 `Cylinder` 충돌체를 해당 위치에 생성.
    - 모든 충돌체를 하나의 `RigidBody`에 결합(Compound Shape).

### [MODIFY] `src/widgets/Physics.ts`
- 물리 디버그 시각화 기능 활성화:
    - URL 파라미터 `?debug=physics` 감지 시 `PhysicsDebug` 메시를 씬에 추가하여 생성된 기둥들을 육안으로 확인 가능하게 함.

## 검증 계획 (Verification Plan)
1. **시각적 검증**: 브라우저에서 `?debug=physics`를 입력하여 산 모델 주위에 원기둥 충돌체들이 빽빽하게 생성되었는지 확인.
2. **물리 검증**: 우주선으로 산에 부딪혔을 때 관통하지 않고 정확한 높이에서 멈추거나 튕겨나가는지 확인.
3. **성능 검증**: 다수의 산이 배치된 환경에서도 프레임 드랍 없이 물리 연산이 유지되는지 확인.

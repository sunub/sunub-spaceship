# 구현 계획 - 투명 벽(Invisible Walls) 월드 경계

## 목표 설명 (Goal Description)
`Floor` 모델 주변에 보이지 않는 물리 벽(Invisible Collision Walls)을 설치하여 플레이어의 우주선이 지정된 게임 전체 영역 밖으로 나가지 못하도록 제한합니다. `Rapier` 엔진의 물리 충돌 기능을 활용하여 월드 경계를 구축합니다.

## 기술 구성 (Tech Stack)
- **Physics**: `Rapier` (Fixed RigidBody, Collider).
- **Geometric**: Floor BoundingBox 기반 경계 계산.

## 제안된 변경 사항 (Proposed Changes)

### [src/widgets/Models/Floor/Floor.ts]
- **경계 측정**: `setupModelStructure` 메서드에서 Floor 모델의 전체 너비(`width`)와 깊이(`depth`)를 계산하여 저장.
- **경계 생성**: `createBoundaries(physics: Physics)` 메서드 추가:
    - 동, 서, 남, 북 4개 면에 충분한 높이(예: 500 단위)를 가진 투명 박스 충돌체 배치.
    - 고정된 강체(Fixed RigidBody) 타입으로 설정하여 우주선이 뚫고 나가지 못하도록 차단.
- **물리 통합**: `createPhysicsBody` 내에서 지형 메시와 함께 벽 충돌체들을 한꺼번에 물리 엔진에 등록.

## 검증 계획 (Verification Plan)
1. **이동 제한 확인**: 평면의 가장자리 끝으로 비행했을 때 우주선이 멈추거나 튕겨 나가는지 확인.
2. **사각지대 확인**: 동서남북 4면의 모든 경계선에서 빠짐없이 충돌이 일어나는지 사분면 별로 테스트.
3. **충돌 정합성**: 우주선이 과도한 속도로 충돌해도 경계 벽을 뚫고 지나가는 현상이 발생하는지 예외 케이스 확인.

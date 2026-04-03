# 구조 개선 - InversifyJS 의존성 주입(DI) 아키텍처 오류 수정

## 목표 설명 (Goal Description)
`InversifyJS` 설정 시 발생하던 "Unexpected undefined service id type" 오류를 해결합니다. `GAME_CONTEXT` 객체의 중첩된 속성 사용 방식을 수정하여 안정적인 의존성 주입과 모듈 간 결합도 완화를 달성합니다.

## 기술 구성 (Tech Stack)
- **Library**: `InversifyJS`, `reflect-metadata`.
- **Architecture**: Service Identifier (Symbol) 기반 DI 컨테이너.

## 제안된 변경 사항 (Proposed Changes)

### [DI 구조 수정]
- **네임스페이스 정리**: `GAME_CONTEXT` 내의 유틸리티(`Size`, `Time`)와 매니저(`DOMManager`, `InputManager`) 토큰을 각각 `UTILITY`와 `MANAGER` 네임스페이스로 명확히 분리.
- **`Camera.ts` / `CSSRenderer.ts` 수정**:
    - `@inject(GAME_CONTEXT.Size)` 대신 `@inject(GAME_CONTEXT.UTILITY.Size)` 등 분리된 토큰으로 참조 변경.
- **순환 참조 방지**: `Game.ts`에서 불필요한 `Entry` 임포트를 제거하여 모듈 간 로드 순서 꼬임 방지.

## 검증 계획 (Verification Plan)
1. **런타임 확인**: 게임 구동 시 콘솔창에 "Unexpected undefined service id type" 에러가 더 이상 나타나지 않는가?
2. **동작 확인**: 카메라 조종과 CSS 렌더링 기능이 의존성 주입 후에도 정상적으로 작동하고 있는가?
3. **DI 정합성**: 모든 주입된 서비스 인스턴스가 올바른 클래스 타입으로 해소(resolve)되고 있는가?

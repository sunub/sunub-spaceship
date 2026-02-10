refactor: ServiceLocator에서 InversifyJS DI Container로 전환 및 Bootstrap 패턴 도입

## 변경 동기

ServiceLocator 패턴의 한계:
- 문자열 키 기반 조회로 인한 런타임 에러 위험
- 암시적 의존성으로 테스트 및 리팩토링 어려움
- 순환 의존성 감지 불가
- 수동 초기화 순서 관리 필요

## 주요 개선사항

### 1. DIContainer 도입 (InversifyJS)
- Symbol 기반 타입 안전한 의존성 식별
- 생성자 주입으로 명시적 의존성 선언
- Singleton/Transient/Factory 생명주기 관리
- 순환 의존성 자동 감지

Before:
```typescript
class Game {
    constructor() {
        this.time = ServiceRegistry.getInstance().get<Time>('Time')
    }
}
```

After:
```typescript
@injectable()
class Game {
    constructor(@inject(GAME_CONTEXT.Time) private time: Time) {}
}
```

### 2. GameBootstrapper 패턴
게임 초기화를 5단계로 체계화:
- Phase 1: 필수 시스템 (Renderer, Camera, Lighting)
- Phase 2: 진입 화면 설정
- Phase 3: 에셋 병렬 로딩 (Models, Textures, Physics)
- Phase 4: 게임 오브젝트 준비
- Phase 5: 사용자 인터랙션 시작

아키텍처 개선:
- main.ts: 진입점 (DI Container 초기화)
- GameBootstrapper: 초기화 오케스트레이션
- Game: 게임 루프 및 비즈니스 로직

## 효과

✅ 컴파일 타임 타입 안정성 확보
✅ 테스트 용이성 향상 (Mock 주입 가능)
✅ 초기화 흐름 가시성 및 유지보수성 개선
✅ 병렬 로딩으로 초기화 성능 최적화

## 영향 범위

변경: main.ts, Game.ts, GameBootstrapper.ts (신규)
추가: inversify.config.ts, DOMManager.ts
삭제 예정: ServiceRegistry.ts

Breaking Changes: 없음 (내부 구현만 변경)

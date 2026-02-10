refactor: ServiceLocator에서 InversifyJS DI Container로 전환 및 Bootstrap 패턴 도입

## 🎯 변경 동기

### AS-IS: ServiceLocator 패턴의 한계
기존 시스템은 `ServiceRegistry`를 사용한 ServiceLocator 패턴으로 의존성을 관리했습니다:

```typescript
// 문제가 있던 기존 방식
class Game {
    constructor() {
        this.time = ServiceRegistry.getInstance().get<Time>('Time')
        this.physics = ServiceRegistry.getInstance().get<Physics>('Physics')
        // ... 수십 개의 서비스 get 호출
    }
}
```

**주요 문제점:**
1. **런타임 의존성 해결**: 타입 안정성이 컴파일 타임에 보장되지 않음
   - 문자열 키 기반 조회로 인한 오타 가능성
   - 서비스가 등록되지 않았을 때 런타임 에러 발생
   
2. **암시적 의존성**: 클래스가 필요로 하는 의존성이 시그니처에 명시되지 않음
   - 코드만 보고는 어떤 서비스가 필요한지 파악 불가
   - 테스트 시 어떤 Mock을 준비해야 할지 불명확
   
3. **순환 의존성 추적 불가**: 서비스 간 순환 참조 발생 시 감지 어려움
   
4. **초기화 순서 보장 불가**: 서비스 등록 순서를 수동으로 관리해야 함

### TO-BE: InversifyJS 기반 DI Container

```typescript
// 개선된 방식
@injectable()
class Game {
    constructor(
        @inject(GAME_CONTEXT.Time) private time: Time,
        @inject(GAME_CONTEXT.Physics) private physics: Physics,
        @inject(GAME_CONTEXT.Camera) private camera: Camera,
        // 의존성이 생성자 시그니처에 명시적으로 선언됨
    ) {}
}
```

## ✨ 주요 개선 사항

### 1. 타입 안전성 (Type Safety)
- **Symbol 기반 식별자**: 문자열 대신 `Symbol`을 사용하여 컴파일 타임 타입 체크
- **명시적 타입 선언**: 각 바인딩에서 제네릭 타입 명시
```typescript
DIContainer.bind<Time>(GAME_CONTEXT.Time).to(Time).inSingletonScope()
```

### 2. 의존성 명확화 (Explicit Dependencies)
- 생성자 파라미터로 모든 의존성이 명시됨
- 클래스 정의만으로 필요한 서비스를 즉시 파악 가능
- IDE 자동완성 및 리팩토링 지원 향상

### 3. 생명주기 관리 (Lifecycle Management)
```typescript
// Singleton: 전역 상태를 가지는 시스템
DIContainer.bind<Time>(GAME_CONTEXT.Time).to(Time).inSingletonScope()

// Transient: 매번 새 인스턴스를 생성해야 하는 엔티티
DIContainer.bind<SpaceShip>(GAME_CONTEXT.SpaceShip).to(SpaceShip).inTransientScope()

// Factory: 동적 생성이 필요한 경우
DIContainer.bind<Factory<SpaceShip>>(GAME_CONTEXT.SpaceShipFactory).toFactory(...)
```

### 4. 순환 의존성 감지
- InversifyJS는 순환 의존성 발생 시 명확한 에러 메시지 제공
- 아키텍처 설계 단계에서 문제를 조기에 발견 가능

## 🏗️ Bootstrap 패턴 도입

### 문제 상황
게임 초기화 로직이 `main.ts`와 `Game.ts`에 분산되어 있어:
- 초기화 순서를 파악하기 어려움
- 비즈니스 로직(Game)과 부트스트랩 로직이 혼재
- 테스트가 어려움

### 해결책: GameBootstrapper 클래스

**단일 책임 원칙(SRP) 준수:**
```typescript
@injectable()
export class GameBootstrapper {
    public async run() {
        // Phase 1: 필수 시스템 로드 (렌더러, 카메라, 조명)
        await this.rendering.setRenderer(this.domManager.canvas)
        await this.camera.initialize()
        this.lighting.initialize()
        
        // Phase 2: 진입 화면 설정
        await this.resources.load(entrySources)
        await this.entry.setupEntryScene(this.game.getContext())
        
        // Phase 3: 게임 에셋 로딩 (병렬 처리)
        await this.loadRemainingAssets(onProgress)
        
        // Phase 4: 게임 오브젝트 준비
        await this.game.prepareGameObjects()
        
        // Phase 5: 사용자 인터랙션 대기
        this.entry.enableStartButton(() => this.game.startGame())
    }
}
```

**아키텍처적 이점:**
1. **단계별 초기화 가시성**: 각 Phase가 명확하게 구분됨
2. **의존성 주입 활용**: 모든 시스템이 주입되어 Mocking 가능
3. **관심사 분리**: 
   - `main.ts`: 애플리케이션 진입점 (최소한의 역할)
   - `GameBootstrapper`: 초기화 오케스트레이션
   - `Game`: 게임 루프 및 로직 실행
4. **에러 핸들링 집중화**: 부트스트랩 실패를 한 곳에서 처리

### 병렬 로딩 최적화
```typescript
private async loadRemainingAssets(onProgress) {
    const [models, textures, rapier] = await Promise.all([
        this.resources.load(modelSources, handleProgress),
        this.resources.load(textureSources, handleProgress),
        import("@dimforge/rapier3d-compat")
    ])
    // 3개 작업이 병렬로 수행되어 로딩 시간 단축
}
```

## 📊 마이그레이션 영향 범위

### 변경된 파일
- `src/main.ts`: ServiceRegistry 제거, DIContainer 사용
- `src/core/GameBootstrapper.ts`: 신규 생성
- `src/core/DI/inversify.config.ts`: 신규 생성
- `src/widgets/Game.ts`: 생성자 주입으로 변경
- `src/widgets/Models/SpaceShip/*.ts`: JoyStick 의존성 주입

### 삭제 예정
- `src/core/ServiceRegistry.ts`: 더 이상 사용되지 않음

## 🔄 Breaking Changes
없음. 외부 API는 변경되지 않았으며, 내부 아키텍처만 개선되었습니다.

## 🧪 테스트 전략
```typescript
// 이제 의존성을 쉽게 Mocking 가능
const mockTime = { delta: 16, elapsed: 1000 }
const mockPhysics = { step: jest.fn() }

const game = new Game(
    mockTime,
    mockSize,
    mockInputManager,
    // ... 모든 의존성을 제어 가능
)
```

## 📚 참고 자료
- InversifyJS: https://inversify.io/
- Dependency Injection 패턴: https://martinfowler.com/articles/injection.html
- Bootstrap 패턴: Game Programming Patterns

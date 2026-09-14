# 거대 컨텍스트에서 Service Locator를 거쳐 DIContainer까지

> sunub-spaceship의 의존성 관리 구조가 세 번 바뀐 이유와, 각 단계에서 실제로 무엇이 풀리고 무엇이 안 풀렸는지에 대한 기록.

---

## 0. 한 줄 요약

객체를 하나 추가할 때마다 **게임 전체를 넘겨줘야 하는** 구조에서 출발했다.
Service Locator로 "전체를 넘기는" 문제는 없앴지만 "무엇에 의존하는지 알 수 없는" 문제가 남았고,
DIContainer로 옮기면서 **의존성을 생성자 시그니처에 강제로 드러내** 두 문제를 함께 정리했다.

핵심 지표 하나만 꼽자면 이것이다.

```
DIContainer.get() 호출 지점: 전체 코드베이스에서 1곳 (src/main.ts:54)
@inject 선언:              154개
@injectable 클래스:         49개
```

컨테이너를 직접 두드리는 곳이 진입점 단 하나라는 것 — 이게 Service Locator를 흉내만 낸 게 아니라
실제로 걷어냈다는 증거다.

---

## 1. 출발점: `GameContext`라는 거대한 매개변수

초기 구조에서 모든 게임 오브젝트는 `GameContext`라는 단일 객체를 받았다.
지금은 삭제됐지만(`0f8c0bb refactor : 불필요해진 거대한 GameContext 제거`) 히스토리에 그대로 남아 있다.

```ts
// src/core/GameContext.ts (삭제됨)
export interface GameContext {
    cssRenderer: CSSRenderer
    rendering: Rendering
    scene: Scene
    camera: Camera
    physics: Physics
    time: Time
    size: Size
    debug: Debug
    inputManager: InputManager
    resources: Resources
    lighting: Lighting
    rapier: typeof RAPIER
    audio: Audio
    game: Game          // ← 컨텍스트가 게임 자기 자신을 다시 들고 있다
}

export interface IGameObject {
    initialize?(context: GameContext): void | Promise<void>
    update(deltaTime: number): void
    // ...
}
```

필드 14개짜리 인터페이스이고, 그중 하나는 `Game` 자기 자신이다.
그리고 이 타입이 `IGameObject.initialize()`의 **시그니처에 박혀 있었다.**
즉 게임 오브젝트가 되려면 선택의 여지 없이 게임 전체를 받아야 했다.

### 여기서 실제로 겪은 문제

**(1) 객체 하나 추가할 때마다 시스템 전체를 통과시켜야 했다.**
바닥에 아이콘 하나 띄우는 `ImagePlane`을 만들어도 `Rendering`, `Physics`, `Rapier`,
`Debug`, `InputManager`를 전부 아는 객체가 됐다. 실제로 필요한 건 씬에 붙일 방법과 텍스처 하나뿐인데도.

**(2) 변경 영향 범위가 타입에 드러나지 않았다.**
이게 진짜 비용이었다. `Floor`의 속성 하나를 고쳤을 때, 누가 그걸 보고 있는지 알아내는 방법이
**전수 조사밖에 없었다.** 모든 오브젝트가 `context.game`을 통해 `Game`에 닿을 수 있고,
`Game`은 다시 월드 오브젝트에 닿을 수 있었기 때문이다.
컴파일러는 아무 경고도 주지 않는다 — 타입상으로는 모두가 모두에게 합법적으로 접근 가능했으니까.

결과적으로 "고쳤는데 엉뚱한 데서 터진다"가 반복됐다. 그리고 그 확인 작업은 사람이 꼼꼼히
해야 하는 종류의 일이라 — 사람이 하는 일이 늘 그렇듯 — 빠뜨렸다.

---

## 2. 1차 개선: Service Locator

첫 번째 시도는 전역 레지스트리였다. 컨텍스트를 통째로 넘기는 대신,
필요한 놈이 필요할 때 꺼내 쓰게 하자는 발상이다.

```ts
// src/core/ServiceRegistry.ts
export class ServiceRegistry {
    private static instance: ServiceRegistry
    private services = new Map<string, any>()

    static getInstance(): ServiceRegistry { /* ... */ }

    register<T>(key: string, service: T): void {
        this.services.set(key, service)
    }

    get<T>(key: string): T {
        const service = this.services.get(key)
        if (!service) throw new Error(`Service ${key} not found`)
        return service as T
    }
}
```

### 나아진 것

- **전달 사슬이 끊겼다.** 새 객체를 만들 때 상위 객체가 무엇을 갖고 있는지 신경 쓸 필요가 없어졌다.
  중간 계층이 자기가 쓰지도 않는 의존성을 손에 들고 아래로 내려보내는 일이 사라졌다.
- **추가 비용이 상수가 됐다.** 객체를 하나 더 만들어도 기존 생성자 시그니처를 건드릴 일이 없다.

여기까지는 의도대로였다.

### 안 나아진 것 — 블랙박스

문제는 **의존성이 여전히 보이지 않는다**는 것이었다. 오히려 이전보다 나빠진 면도 있다.

```ts
// Service Locator 시절의 전형적인 모양
class SomeModel {
    constructor() {}            // ← 의존성이 하나도 없어 보인다

    initialize() {
        const scene = ServiceRegistry.getInstance().get<Scene>("scene")
        const physics = ServiceRegistry.getInstance().get<Physics>("physics")
        // ...
    }

    update(dt: number) {
        const time = ServiceRegistry.getInstance().get<Time>("time")   // 여기서도 꺼낸다
    }
}
```

구체적으로 세 가지가 안 풀렸다.

**(1) 생성자 시그니처가 거짓말을 한다.**
`constructor()`는 "나는 아무것도 필요 없다"고 말하지만 실제로는 3개를 쓴다.
의존성을 알려면 클래스 본문 전체를 `get(` 으로 grep해야 한다.
`Floor`를 고쳤을 때 누가 영향을 받는지 알아내는 문제가 — 전수 조사라는 점에서 — 1단계와 똑같이 남았다.

**(2) 키가 문자열이고 반환이 `any`다.**
`get<T>(key: string)`의 내부는 `return service as T`다. 컴파일 타임 검증이 0이다.
`"scene"`을 `"Scene"`으로 잘못 쓰면 타입 체커는 통과하고 런타임에 던진다.

**(3) 실패 시점이 밀린다.**
`get()`이 메서드 안에 흩어져 있으니, 등록 순서가 꼬였을 때
"부팅은 됐는데 플레이 중 특정 조건에서만 터지는" 형태가 된다.

정리하면 **"전부 넘겨받는 문제"는 풀었지만 "무엇을 쓰는지 모르는 문제"는 그대로**였다.
1단계에서 나를 괴롭혔던 게 결국 후자였다는 걸, 1차 개선을 하고 나서야 알았다.

---

## 3. 2차 개선: DIContainer

그래서 방향을 뒤집었다.
**객체가 컨테이너에서 꺼내오는(pull) 게 아니라, 컨테이너가 객체에게 밀어넣는(push) 구조.**

의존성을 숨길 수 있는 자리 자체를 없애는 게 목적이었다.
InversifyJS 7을 쓴 건 TypeScript 데코레이터로 그걸 **문법 차원에서 강제**할 수 있어서다.

### 3-1. 토큰: Symbol로 문자열 키를 대체

```ts
// src/core/DI/DITypes.ts — 총 64개 토큰
const MODEL = {
    Floor: Symbol.for("Floor"),
    SpaceShip: Symbol.for("SpaceShip"),
    // ...
}
const SERVICE = {
    PhysicsService: Symbol.for("PhysicsService"),
    ResourceService: Symbol.for("ResourceService"),
    // ...
}

export const GAME_CONTEXT = { MODEL, FACTORY, CONTROLLER, MANAGER, SERVICE, CORE, EXTERNAL, UTILITY, UI }
```

Service Locator의 `"scene"` 문자열이 `GAME_CONTEXT.CORE.Scene` 심볼이 됐다.
오타는 이제 컴파일 에러다. 네임스페이스를 8개로 나눈 덕에 토큰만 봐도 그 객체의 계층이 읽힌다.

> 참고: 이 네임스페이스 분리는 처음부터 의도한 게 아니라 사고 대응이었다.
> 평평한 `GAME_CONTEXT`를 쓰다가 `Unexpected undefined service id type` 런타임 에러를 만났고,
> 그때 `UTILITY` / `MANAGER`로 쪼갰다. (`plan/08_InversifyJS_DI_Architecture_Fix.md`)

### 3-2. 모듈: 바인딩을 계층별로 중앙 집중

```ts
// src/core/DI/inversify.config.ts
const DIContainer = new Container()

DIContainer.load(
    UtilityModule,    // 1. 유틸리티 (Time, Size — 의존성 없음)
    ServiceModule,    // 2. 서비스 (Resources — 유틸리티에 의존)
    ModelModule,      // 3. 모델 (TreeLights, Floor — 서비스에 의존)
    FactoryModule,    // 4. 팩토리 (모델에 의존)
    ManagerModule,    // 5. 매니저 (팩토리에 의존)
    UIModule,         // 6. UI (매니저에 의존)
    CoreModule,       // 7. 코어 (매니저, 서비스에 의존)
    ControllerModule, // 8. 컨트롤러
)
```

**이 파일이 이 리팩토링의 핵심 산출물이다.** 시스템 전체의 계층 구조가 여기 8줄에 다 있다.
로드 순서 주석은 각 계층이 아래 계층에만 의존한다는 설계 규칙을 문서화한 것이고,
새 객체를 추가할 때 "어느 모듈에 넣을 것인가"를 정하는 것만으로 그 객체의 위치가 결정된다.

### 3-3. Composition Root: 컨테이너를 두드리는 곳은 한 군데

```ts
// src/main.ts — 전체 코드베이스에서 유일한 DIContainer.get()
const main = async () => {
    const gameBootstrapper = DIContainer.get<GameBootstrapper>(
        GAME_CONTEXT.CORE.GameBootstrapper,
    )
    await gameBootstrapper.run()
}
```

이게 Service Locator와의 결정적 차이다.
Service Locator는 **모든 객체가** 레지스트리를 알아야 한다. DI는 **진입점 하나만** 컨테이너를 안다.
나머지 174개 파일 중 어디에도 `DIContainer` import가 없다.

### 3-4. 결과: 의존성이 생성자에 전부 드러난다

```ts
// src/core/Game.ts
@injectable()
export class Game {
    constructor(
        @inject(GAME_CONTEXT.MANAGER.WorldManager)      private readonly worldManager: WorldManager,
        @inject(GAME_CONTEXT.MANAGER.ProjectManager)    private readonly projectManager: ProjectManager,
        @inject(GAME_CONTEXT.CORE.EventBus)             private readonly eventBus: EventBus,
        @inject(GAME_CONTEXT.FACTORY.SpaceShipFactory)  private readonly spaceShipFactory: () => SpaceShip,
        @inject(GAME_CONTEXT.MANAGER.EnvironmentManager) private readonly environmentManager: EnvironmentManager,
        @inject(GAME_CONTEXT.UI.InputIndicator)         private readonly inputIndicator: InputIndicator,
        @inject(GAME_CONTEXT.UI.Notification)           private readonly notification: Notification,
        @inject(GAME_CONTEXT.UI.TerminalOverlay)        private readonly terminalOverlay: TerminalOverlay,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipCameraController)
                                                        private readonly spaceShipCameraController: SpaceShipCameraController,
        @inject(GAME_CONTEXT.CORE.Audio)                private readonly audio: Audio,
        @inject(GAME_CONTEXT.UTILITY.Time)              private readonly time: Time,
        @inject(GAME_CONTEXT.MANAGER.InputManager)      private readonly inputManager: InputManager,
    ) {}
```

`Game`이 무엇에 의존하는지 알려면 이 12줄만 읽으면 된다. 본문을 볼 필요가 없다.
그리고 **역방향도 성립한다.** `WorldManager`를 고쳤을 때 누가 영향받는지 알고 싶으면
`GAME_CONTEXT.MANAGER.WorldManager`를 grep하면 끝이다 — 3곳이 나온다.
1단계에서 "전수 조사"였던 게 여기서는 "토큰 1개 검색"이 됐다.

`GameContext` 14개 필드를 통으로 받던 것과 비교하면, 이제 각 클래스가 선언한 것만 받는다.
`Notification`처럼 아무것도 필요 없는 클래스는 정말로 `constructor()`가 비어 있고,
그 빈 생성자를 이제는 **믿을 수 있다.**

---

## 4. 블랙박스가 정확히 어떻게 풀렸는가

여기서 메커니즘을 정확히 짚고 넘어가야 한다. 흔히 "데코레이터가 프록시를 만들어서"라고
설명하곤 하는데, 이 코드베이스에는 **Proxy가 한 줄도 없다.** 실제로 일어나는 일은 이렇다.

### 4-1. 메타데이터 리플렉션 (Proxy 아님)

```jsonc
// tsconfig.json
"experimentalDecorators": true,
"emitDecoratorMetadata": true,   // ← 이게 핵심
```

```ts
// src/main.ts 최상단
import "reflect-metadata"
```

`emitDecoratorMetadata`가 켜져 있으면 TypeScript 컴파일러가 데코레이터 붙은 클래스에 대해
**생성자 파라미터 타입 정보를 `design:paramtypes` 메타데이터로 emit한다.**
`@inject(토큰)`은 거기에 "n번째 파라미터는 이 심볼로 해결하라"는 표식을 추가로 심는다.

런타임에 컨테이너가 하는 일은 단순하다.

```
reflect-metadata로 클래스의 파라미터 토큰 목록을 읽는다
  → 각 토큰을 재귀적으로 resolve한다
  → 다 모이면 new Clazz(...resolved) 한다
```

프록시로 감싸서 가로채는 게 아니라, **생성 시점에 완성된 실체를 넣어준다.**
그래서 객체 입장에서는 자기가 DI 컨테이너 위에서 돌아가는지조차 모른다 — `new Game(a, b, c)`로
직접 만들어도 똑같이 동작한다. 테스트 가능성이 올라간 건 이 성질 덕분이다.

### 4-2. 블랙박스가 풀린 진짜 이유

데코레이터가 마법을 부려서가 아니다.
**의존성을 숨길 수 있는 자리를 문법적으로 없앴기 때문**이다.

| | Service Locator | DIContainer |
|---|---|---|
| 의존성 선언 위치 | 메서드 본문 어디든 | 생성자 파라미터 (한 곳) |
| 키 타입 | `string` | `Symbol` |
| 반환 타입 안정성 | `any as T` | 바인딩 시점 제네릭 검증 |
| "누가 X를 쓰나?" | 전 파일 grep + 문자열 매칭 | 토큰 1개 검색 |
| 실패 시점 | 그 코드가 실행될 때 | 그래프 resolve 시점 |

`get()`을 아무 데서나 부를 수 있는 한 블랙박스는 안 풀린다.
데코레이터의 역할은 **의존성 선언을 생성자 시그니처 한 곳으로 몰아넣는 것**이고,
그 결과 "코드를 직접 읽어야만 알 수 있던 것"이 "시그니처만 보면 아는 것"이 됐다.

### 4-3. 부팅 시점에 그래프가 세워진다 — 단, 이유는 따로 있다

"앱 실행 시점에 의존성 그래프가 그려져서 문제를 빨리 잡는다"는 건 결과적으로 맞는데,
**Inversify가 컨테이너 로드 때 전체를 검증해주기 때문은 아니다.**
Inversify는 lazy resolve다. `DIContainer.load(...)`는 바인딩만 등록하고 아무것도 만들지 않는다.

이 프로젝트에서 그게 성립하는 이유는 두 가지 설계 선택 때문이다.

**첫째, Composition Root가 하나다.**
`main.ts`의 `get(GameBootstrapper)` 한 번이 `GameBootstrapper`의 12개 의존성을 타고 들어가고,
그중 `Game`이 다시 12개를 타고 들어간다. 진입점이 하나라서 그 한 번의 resolve가
사실상 전체 그래프를 훑는다.

**둘째, `WorldManager`가 생성자에서 팩토리를 즉시 호출한다.**

```ts
// src/Manager/WorldManager.ts
constructor(
    @inject(GAME_CONTEXT.FACTORY.FloorFactory) floorFactory: () => Floor,
    @inject(GAME_CONTEXT.FACTORY.MountainFactory) mountainFactory: () => Mountain,
    // ...
) {
    this.worldObjects = [
        floorFactory(),        // ← 여기서 Floor 그래프가 통째로 만들어진다
        mountainFactory(),
        grassFactory({ count: 45000, width: 0.15, height: 1.0 }),
        // ...
    ]
}
```

즉 배선이 틀렸으면 게임 화면이 뜨기 전에 터진다.
Service Locator였다면 "플레이 중 특정 오브젝트를 처음 건드릴 때" 터졌을 실수다.

다만 정확히 하자면 **전부는 아니다.** `SpaceShipFactory`는 `Game.prepareGameObjects()`에서
호출되므로 `SpaceShip`의 하위 그래프(컨트롤러 6종, `CollisionSensor` 등)는 그 시점에 만들어진다.
Phase 3까지가 사실상의 검증 지점이라고 보는 게 맞다.

---

## 5. 부수적으로 딸려온 개선

DI로 옮기면서 자연스럽게 따라온 것들이 있다. 원래 목표는 아니었는데 결과적으로 더 컸다.

### 5-1. 구현체가 아니라 인터페이스에 의존하게 됐다

주입 대상을 명시하려다 보니 "이 객체가 진짜로 필요한 최소한이 뭔가"를 매번 결정해야 했다.
그 압력이 인터페이스를 만들게 했다.

```ts
// src/Services/ISceneManager.ts — 전부
export interface ISceneManager {
    add(object: Object3D): void
    remove(object: Object3D): void
    getObjectByName(name: string): Object3D | undefined
}
```

```ts
// src/Models/Floor/Floor.ts
constructor(
    @inject(GAME_CONTEXT.SERVICE.ResourceService) resourcesManager: IResourceService,
    @inject(GAME_CONTEXT.MANAGER.SceneManager)   sceneManager: ISceneManager,
    @inject(GAME_CONTEXT.SERVICE.PhysicsService) private readonly physicsService: IPhysicsService,
) { /* ... */ }
```

`Floor`는 이제 Three.js `Scene`이 아니라 **메서드 3개짜리 인터페이스**에 의존한다.
`IResourceService`는 `getItem()` 하나뿐이다.
`GameContext` 14개 필드 → 인터페이스 3개, 그중 실제 접근면은 총 5개 메서드.

여기서 앞의 "Floor를 고치면 뭐가 깨지나" 질문이 어떻게 바뀌었는지 보면 —
현재 `Floor`를 붙잡고 있는 코드는 딱 세 군데다.

```
WorldManager.terrain                        // 보관
MeshDefaultMaterial.setup({ terrian })      // 셰이더가 지형 정보를 참조
GameBootstrapper.run()                      // 위 둘을 배선
```

전수 조사가 아니라 3곳 확인이다. 그리고 그 3곳은 grep 한 번에 나온다.

### 5-2. 공통 인프라를 부모 클래스로 흡수할 수 있게 됐다

의존성이 인터페이스로 좁혀지자 모델들의 중복이 눈에 보였다 —
모델 로드, 클론, 씬 부착/해제, 물리 바디 생성이 매번 반복되고 있었다.
`ResourceModel`이라는 추상 클래스로 뽑아냈다.

```ts
// src/Models/ResourceModel.ts
export abstract class ResourceModel implements IGameObject {
    constructor(
        protected readonly resourcesManager: IResourceService,
        protected readonly sceneManager: ISceneManager,
        protected modelName: string = "",
        // ...
    ) {}

    public async initialize(addToScene = true): Promise<void> {
        await this.loadModel()
        await this.setupPhysics()
        this.onModelLoaded()
        if (addToScene) this.attachToScene()
    }

    protected abstract update(deltaTime: number, alpha?: number): void
}
```

`GameContext`를 받던 `BaseModel`과 비교하면 방향이 정반대다.
`BaseModel`은 **모든 것을 물려줬고**, `ResourceModel`은 **리소스 로딩이라는 한 가지 책임만** 물려준다.
개별 모델은 `setupModelStructure()` 같은 훅만 구현하면 된다.

### 5-3. 런타임 통신은 EventBus로 분리

DI는 **생성 시점**의 의존성을 푼다. **실행 시점**의 결합은 다른 문제다.
`SpaceShip`이 상태를 알릴 때마다 UI를 직접 참조하면 결국 다시 얽힌다.

```ts
// src/core/Game.ts
this.eventBus.emit(GameEvents.PLAYER_READY, { spaceshipRigidBody: this.spaceShip.rigidBody })

const unsubOpen = this.eventBus.on(GameEvents.TERMINAL_OPENED, () => this.spaceShip?.lock())
this.disposables.push(unsubOpen)
```

`on()`이 구독 해제 함수를 반환하게 만들어서 `disposables` 배열에 모아 두고
`dispose()`에서 한 번에 정리한다 — 핸들러 참조를 따로 보관할 필요가 없다.

**DI는 "누가 누구를 아는가", EventBus는 "누가 누구에게 말하는가"를 담당한다.** 이 둘을 섞지 않은 게
구조가 다시 무너지지 않은 이유라고 본다.

---

## 6. 정직하게 덧붙이는 것들

글이 실제 코드와 어긋나면 안 되니 확인한 것들을 그대로 적는다.

**(1) Service Locator 단계는 커밋 히스토리에 없다.**
현재 리포지토리의 최초 커밋(`243b1bd`)은 이미 DI가 들어간 상태의 스쿼시 커밋이다.
`ServiceRegistry.ts`는 그 시점에 이미 **참조 0**인 채로 파일만 남아 있었다.
즉 이 단계는 코드 화석으로만 뒷받침되고, 커밋으로 증명되지는 않는다.
반면 `GameContext` → DI 전환은 `0f8c0bb`, `705def9`, `2d42d50` 등으로 히스토리에 남아 있다.

**(2) `ServiceRegistry.ts`는 지금도 리포지토리에 남아 있다.** 참조하는 곳은 없다.
같은 상태의 파일이 `src/Manager/UIManager.ts`, `src/Manager/GameEventManager.ts`에도 있다.
리팩토링 과정에서 지우지 않고 남긴 죽은 코드다.

**(3) README가 아직 옛 구조를 설명하고 있다.**
"ServiceRegistry 패턴: 공통 서비스는 ServiceRegistry를 통해 등록/조회되며"는 현재 사실이 아니다.
등록/조회는 전부 `DIContainer`가 하고 `ServiceRegistry`는 아무것도 하지 않는다.

**(4) `ModelModule.ts`에 디버그 로그가 남아 있다.**
`console.log("DIModels Debug:", GAME_CONTEXT.MODEL)` — `Unexpected undefined service id type`를
잡을 때 넣은 것이 그대로 있다.

---

## 7. 남는 질문

세 단계를 거치고 나서 드는 생각은, 결국 매번 같은 질문에 답하고 있었다는 것이다.

> **"이 코드를 고치면 어디가 깨지는가?"**

- **거대 컨텍스트**: 알 수 없다. 전부 확인해야 한다.
- **Service Locator**: 알 수 없다. 다만 확인할 코드의 양은 줄었다.
- **DIContainer**: 토큰을 검색하면 나온다.

의존성 주입의 가치는 "결합도를 낮춘다" 같은 추상적인 문장이 아니라
**변경 영향 범위를 기계가 계산할 수 있게 만든다**는 데 있었다.
`@inject` 154개는 그 대가로 치른 보일러플레이트고, 나는 그 거래가 남는 장사였다고 생각한다.

다만 아직 안 풀린 것도 있다.
`Game`과 `GameBootstrapper`가 각각 12개씩 의존성을 갖는다는 건 여전히 그 두 클래스가
너무 많은 걸 조율하고 있다는 신호다. DI는 그 사실을 **감추지 않고 드러내 줬을 뿐**,
대신 해결해 주지는 않는다.
생성자 파라미터 개수가 설계 냄새의 지표가 됐다는 것 자체가 이전 구조에서는 불가능했던 일이니,
그건 그것대로 소득이라고 본다.

---

## 부록: 수치

| 항목 | 값 |
|---|---|
| TypeScript 파일 | 175 |
| `@injectable` 클래스 | 49 |
| `@inject` 선언 | 154 |
| Symbol 토큰 (`DITypes.ts`) | 64 |
| ContainerModule | 8 |
| `DIContainer.get()` 호출 지점 | **1** (`src/main.ts:54`) |
| `GameContext` 필드 (삭제 전) | 14 |
| 서비스 인터페이스 | 4 (`ISceneManager`, `IResourceService`, `IPhysicsService`, `IGameObject`) |

### 주요 파일

```
src/main.ts                       Composition Root
src/core/DI/inversify.config.ts   컨테이너 조립 + 계층 순서
src/core/DI/DITypes.ts            Symbol 토큰
src/core/DI/*Module.ts            계층별 바인딩 (8개)
src/Models/ResourceModel.ts       모델 공통 인프라
src/Services/I*.ts                서비스 인터페이스
src/core/EventBus/EventBus.ts     런타임 통신
src/core/ServiceRegistry.ts       (죽은 코드 / Service Locator 시절 잔재)
```

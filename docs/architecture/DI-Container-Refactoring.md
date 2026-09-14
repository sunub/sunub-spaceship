# 거대 컨텍스트에서 Service Locator를 거쳐 DIContainer까지

> sunub-spaceship의 의존성 관리 구조가 세 번 바뀐 이유와,
> 각 단계에서 무엇이 풀렸고 **무엇이 아직 안 풀렸는지**에 대한 기록.

---

## 0. 이 글의 검증 기준

기억이 아니라 코드를 근거로 썼다. 주장마다 확인 방법을 병기한다.

| 주장 | 확인 방법 |
|---|---|
| 거대 컨텍스트가 있었다 | `git show 243b1bd:src/core/GameContext.ts` |
| Service Locator를 거쳤다 | `src/core/ServiceRegistry.ts` (참조 0, 파일만 잔존) |
| Service Locator를 걷어냈다 | `DIContainer.get()` 호출 지점 = 1곳 |
| …단, 완전히는 아니다 | `TweakPane.getInstance()` = **9개 파일 10곳** |

마지막 줄이 이 글에서 가장 중요하다. 결론부터 말하면 **이 리팩토링은 끝나지 않았다.**

---

## 1. 문제: 객체 하나 추가하는 비용

초기 구조에서 모든 게임 오브젝트는 `GameContext` 하나를 받았다.
지금은 삭제됐지만(`0f8c0bb refactor : 불필요해진 거대한 GameContext 제거`) 히스토리에 남아 있다.

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
}
```

필드 14개. 그중 하나는 `Game` 자기 자신이다.
그리고 이 타입이 `IGameObject.initialize()`의 **시그니처에 박혀 있었다** — 게임 오브젝트가 되려면
선택의 여지 없이 게임 전체를 받아야 했다.

바닥에 아이콘 하나 띄우는 오브젝트를 만들어도 `Rendering`, `Physics`, `Rapier`, `Debug`,
`InputManager`를 아는 객체가 됐다. 실제로 필요한 건 씬에 붙일 방법과 텍스처 하나뿐인데도.

### 진짜로 아팠던 건 그게 아니었다

객체가 뚱뚱해지는 건 참을 만했다. 못 견딘 건 이거였다.

> **"이 코드를 고치면 어디가 깨지는가?"에 답할 방법이 없다.**

`Floor`의 속성 하나를 바꿨다고 하자. 누가 영향을 받는지 알아내려면 어떻게 해야 하나?
전수 조사밖에 없다. 모든 오브젝트가 `context.game`을 통해 `Game`에 닿을 수 있고,
`Game`은 다시 월드 오브젝트에 닿을 수 있다. 컴파일러는 아무 말도 하지 않는다 —
타입상으로는 **모두가 모두에게 합법적으로 접근 가능**했으니까.

그래서 매번 사람이 꼼꼼히 확인해야 했고, 사람이 하는 일이 늘 그렇듯 빠뜨렸다.
"고쳤는데 엉뚱한 데서 터진다"가 반복됐다.

여기서 문제의 정체가 잡혔다. **결합도가 높은 게 문제가 아니라, 결합의 모양이 안 보이는 게 문제였다.**

---

## 2. 첫 번째 시도: Service Locator

전역 레지스트리를 만들었다. 컨텍스트를 통째로 넘기는 대신, 필요한 놈이 필요할 때 꺼내 쓰게 하자.

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

### 의도대로 된 것

**전달 사슬이 끊겼다.** 새 객체를 만들 때 상위 객체가 뭘 갖고 있는지 신경 쓸 필요가 없어졌고,
중간 계층이 자기가 쓰지도 않는 의존성을 손에 들고 아래로 내려보내는 일이 사라졌다.
객체 추가 비용이 상수가 됐다.

### 안 된 것

두어 주 쓰고 나서 알았다. **1장에서 못 견뎠던 그 문제가 그대로다.**

```ts
// Service Locator 시절의 전형적인 모양
class SomeModel {
    constructor() {}            // ← 의존성이 하나도 없어 보인다

    initialize() {
        const scene = ServiceRegistry.getInstance().get<Scene>("scene")
        const physics = ServiceRegistry.getInstance().get<Physics>("physics")
    }

    update(dt: number) {
        const time = ServiceRegistry.getInstance().get<Time>("time")   // 여기서도 꺼낸다
    }
}
```

구체적으로 셋이다.

**(1) 생성자 시그니처가 거짓말을 한다.**
`constructor()`는 "나는 아무것도 필요 없다"고 말하지만 실제로는 셋을 쓴다.
의존성을 알려면 클래스 본문 전체를 `get(`으로 훑어야 한다.
**"Floor를 고치면 뭐가 깨지나"가 여전히 전수 조사다.** 조사할 코드의 양만 줄었을 뿐이다.

**(2) 키가 문자열이고 반환이 `any`다.**
`get<T>(key: string)`의 내부는 `return service as T`. 컴파일 타임 검증이 0이다.
`"scene"`을 `"Scene"`으로 쓰면 타입 체커는 통과시키고 런타임에 던진다.

**(3) 실패 시점이 뒤로 밀린다.**
`get()`이 메서드 안에 흩어져 있으니 등록 순서가 꼬여도 부팅은 된다.
"플레이 중 특정 조건에서만 터지는" 형태가 된다.

정리하면 — **"전부 넘겨받는 문제"는 풀었지만 "무엇을 쓰는지 모르는 문제"는 그대로**였다.
그리고 애초에 나를 괴롭혔던 건 후자였다.

이걸 깨달은 게 전환점이었다. 문제는 *어디서* 의존성을 가져오는가가 아니라,
**의존성을 숨길 수 있는 자리가 코드에 존재한다**는 것이었다.

---

## 3. 관점의 전환: pull에서 push로

`get()`을 아무 데서나 부를 수 있는 한 블랙박스는 안 풀린다.
그러니 **가져오지 못하게 만들어야 한다.**

- Service Locator: 객체가 레지스트리에서 **꺼낸다(pull)** → 꺼내는 위치가 자유롭다 → 숨을 수 있다
- DI Container: 컨테이너가 객체에 **밀어넣는다(push)** → 받는 위치는 생성자뿐이다 → 숨을 수 없다

목표는 "결합도를 낮추자"가 아니라 **"의존성 선언을 생성자 시그니처 한 곳으로 강제하자"**로 바뀌었다.
InversifyJS 7을 고른 건 TypeScript 데코레이터로 그걸 **문법 차원에서** 강제할 수 있어서다.

---

## 4. DIContainer 설계

### 4-1. 토큰: 문자열 대신 Symbol

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

export const GAME_CONTEXT = {
    MODEL, FACTORY, CONTROLLER, MANAGER, SERVICE, CORE, EXTERNAL, UTILITY, UI,
}
```

`"scene"` 문자열이 `GAME_CONTEXT.CORE.Scene` 심볼이 됐다. 오타는 이제 컴파일 에러다.

> 네임스페이스 8개 분리는 설계가 아니라 **사고 대응**이었다.
> 평평한 `GAME_CONTEXT`를 쓰다가 `Unexpected undefined service id type` 런타임 에러를 만났고,
> 그때 `UTILITY` / `MANAGER`로 쪼갰다. (`plan/08_InversifyJS_DI_Architecture_Fix.md`)
> 지금은 토큰만 봐도 계층이 읽히지만, 그건 결과지 의도가 아니었다.

### 4-2. 모듈: 계층 순서를 코드로 못박기

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

**이 8줄이 이 리팩토링의 실질적 산출물이다.** 시스템의 계층 구조가 여기 다 있다.
새 객체를 추가할 때 "어느 모듈에 넣을 것인가"를 정하는 것만으로 그 객체의 위치가 결정되고,
아래 계층에만 의존한다는 규칙이 따라붙는다.

### 4-3. Composition Root: 컨테이너를 아는 곳은 하나

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
`src/` 175개 파일 중 `DIContainer`를 import하는 건 `main.ts` 하나다.

### 4-4. 결과

```ts
// src/core/Game.ts
@injectable()
export class Game {
    constructor(
        @inject(GAME_CONTEXT.MANAGER.WorldManager)       private readonly worldManager: WorldManager,
        @inject(GAME_CONTEXT.MANAGER.ProjectManager)     private readonly projectManager: ProjectManager,
        @inject(GAME_CONTEXT.CORE.EventBus)              private readonly eventBus: EventBus,
        @inject(GAME_CONTEXT.FACTORY.SpaceShipFactory)   private readonly spaceShipFactory: () => SpaceShip,
        @inject(GAME_CONTEXT.MANAGER.EnvironmentManager) private readonly environmentManager: EnvironmentManager,
        @inject(GAME_CONTEXT.UI.InputIndicator)          private readonly inputIndicator: InputIndicator,
        @inject(GAME_CONTEXT.UI.Notification)            private readonly notification: Notification,
        @inject(GAME_CONTEXT.UI.TerminalOverlay)         private readonly terminalOverlay: TerminalOverlay,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipCameraController)
                                                         private readonly spaceShipCameraController: SpaceShipCameraController,
        @inject(GAME_CONTEXT.CORE.Audio)                 private readonly audio: Audio,
        @inject(GAME_CONTEXT.UTILITY.Time)               private readonly time: Time,
        @inject(GAME_CONTEXT.MANAGER.InputManager)       private readonly inputManager: InputManager,
    ) {}
```

`Game`이 무엇에 의존하는지 알려면 이 12줄만 읽으면 된다. 본문은 볼 필요가 없다.

**그리고 역방향이 성립한다.** 1장의 질문 — "이걸 고치면 어디가 깨지나" — 이 이제 이렇게 답한다.

```console
$ grep -rn "MANAGER.WorldManager" src --include=*.ts
src/Services/GameLoop.ts:35          ← 소비자
src/core/GameBootstrapper.ts:35      ← 소비자
src/core/Game.ts:36                  ← 소비자
src/core/DI/ManagerModule.ts:17      ← 바인딩
```

전수 조사가 토큰 1개 검색이 됐다. **이게 리팩토링의 전부이자 목적이다.**

---

## 5. 블랙박스가 정확히 어떻게 풀렸는가

여기서 메커니즘을 정확히 짚는다. "데코레이터가 프록시를 만들어서"라고 설명하기 쉬운데,
**이 코드베이스에 `Proxy`는 한 줄도 없다.** 실제로 일어나는 일은 이렇다.

### 5-1. 메타데이터 리플렉션 (Proxy 아님)

```jsonc
// tsconfig.json
"experimentalDecorators": true,
"emitDecoratorMetadata": true,   // ← 핵심
```

```ts
// src/main.ts 최상단
import "reflect-metadata"
```

`emitDecoratorMetadata`가 켜지면 컴파일러가 데코레이터 붙은 클래스에 대해
**생성자 파라미터 타입을 `design:paramtypes` 메타데이터로 emit한다.**
`@inject(토큰)`은 거기에 "n번째 파라미터는 이 심볼로 해결하라"는 표식을 얹는다.

런타임에 컨테이너가 하는 일:

```
reflect-metadata로 클래스의 파라미터 토큰 목록을 읽는다
  → 각 토큰을 재귀적으로 resolve
  → 다 모이면 new Clazz(...resolved)
```

프록시로 감싸 가로채는 게 아니라 **생성 시점에 완성된 실체를 넣는다.**
그래서 객체는 자기가 DI 위에서 도는지조차 모른다 — `new Game(a, b, c)`로 직접 만들어도 똑같이 동작한다.
테스트 가능성이 올라간 건 정확히 이 성질 때문이다.

### 5-2. 블랙박스가 풀린 진짜 이유

데코레이터가 마법을 부려서가 아니다. **숨길 자리를 문법적으로 없앴기 때문**이다.

| | Service Locator | DIContainer |
|---|---|---|
| 의존성 선언 위치 | 메서드 본문 어디든 | 생성자 파라미터 (한 곳) |
| 키 타입 | `string` | `Symbol` |
| 반환 타입 안정성 | `any as T` | 바인딩 시점 제네릭 검증 |
| "누가 X를 쓰나?" | 전 파일 grep + 문자열 매칭 | 토큰 1개 검색 |
| 실패 시점 | 그 코드가 실행될 때 | 그래프 resolve 시점 |

데코레이터의 역할은 **선언을 한 곳으로 몰아넣는 것**이고,
그 결과 "코드를 읽어야만 알 수 있던 것"이 "시그니처만 보면 아는 것"이 됐다.

### 5-3. 부팅 시점에 그래프가 세워진다 — 단, 이유는 따로 있다

"앱 실행 시점에 의존성 그래프가 그려져서 문제를 빨리 잡는다"는 결과적으로 맞다.
**하지만 Inversify가 컨테이너 로드 때 전체를 검증해주기 때문은 아니다.**
Inversify는 lazy resolve다. `DIContainer.load(...)`는 바인딩만 등록하고 아무것도 만들지 않는다.

이 프로젝트에서 성립하는 이유는 두 가지 설계 선택 때문이다.

**첫째, Composition Root가 하나다.**
`get(GameBootstrapper)` 한 번이 12개 의존성을 타고 들어가고, 그중 `Game`이 다시 12개를 탄다.
진입점이 하나라 그 한 번의 resolve가 사실상 전체 그래프를 훑는다.

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

배선이 틀렸으면 게임 화면이 뜨기 전에 터진다.
Service Locator였다면 "플레이 중 그 오브젝트를 처음 건드릴 때" 터졌을 실수다.

**정확히 하자면 전부는 아니다.** `SpaceShipFactory`는 `Game.prepareGameObjects()`에서 호출되므로
`SpaceShip`의 하위 그래프(컨트롤러 6종, `CollisionSensor` 등)는 Phase 3에 만들어진다.
검증 지점은 "부팅 직후"가 아니라 "Phase 3까지"로 보는 게 맞다.

---

## 6. 딸려온 것들

원래 목표는 아니었는데 결과적으로 더 컸다.

### 6-1. 구현체가 아니라 인터페이스에 의존하게 됐다

주입 대상을 명시하려니 "이 객체가 진짜로 필요한 최소한이 뭔가"를 매번 결정해야 했다.
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
`GameContext` 14개 필드 → 인터페이스 3개, 실제 접근면 5개 메서드.

그리고 `Floor`를 붙잡는 코드는 이제 세 군데뿐이다.

```
WorldManager.terrain                       // 보관
MeshDefaultMaterial.setup({ terrian })     // 셰이더가 지형 정보 참조
GameBootstrapper.run()                     // 위 둘을 배선
```

### 6-2. 공통 인프라를 부모로 흡수할 수 있게 됐다

의존성이 인터페이스로 좁혀지자 모델들의 중복이 보였다 — 모델 로드, 클론, 씬 부착/해제, 물리 바디 생성.

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

`GameContext`를 받던 `BaseModel`과 방향이 정반대다.
`BaseModel`은 **모든 것을 물려줬고**, `ResourceModel`은 **리소스 로딩이라는 한 가지 책임만** 물려준다.

### 6-3. 런타임 통신은 EventBus로 분리

DI는 **생성 시점**의 의존성을 푼다. **실행 시점**의 결합은 다른 문제다.
`SpaceShip`이 상태를 알릴 때마다 UI를 직접 참조하면 결국 다시 얽힌다.

```ts
// src/core/Game.ts
this.eventBus.emit(GameEvents.PLAYER_READY, { spaceshipRigidBody: this.spaceShip.rigidBody })

const unsubOpen = this.eventBus.on(GameEvents.TERMINAL_OPENED, () => this.spaceShip?.lock())
this.disposables.push(unsubOpen)
```

`on()`이 구독 해제 함수를 반환하게 만들어 `disposables`에 모아 두고 `dispose()`에서 일괄 정리한다 —
핸들러 참조를 따로 보관할 필요가 없다.

**DI는 "누가 누구를 아는가", EventBus는 "누가 누구에게 말하는가"를 담당한다.**
이 둘을 섞지 않은 게 구조가 다시 무너지지 않은 이유라고 본다.

### 6-4. DI 컨테이너 ≠ 의존성 주입

이 구분을 늦게 이해했다. `WorldManager`에는 이런 코드가 있다.

```ts
new ImagePlane(sceneManager, resourcesManager, {
    textureName: "wasdIconTexture",
    position: new Vector3(-2.65, 0.08, -4.5),
    // ...
}),
new Text(sceneManager, { text: "controls", /* ... */ }),
```

컨테이너를 거치지 않고 `new`로 만든다. 처음엔 "일관성이 깨졌다"고 생각해서 팩토리로 바꾸려 했는데,
바꿔 놓고 보니 더 나빴다. 설정값만 다른 인스턴스가 4개인데
토큰 4개 + 바인딩 4개 + 팩토리 4개가 늘어나고, 정작 **설정값은 여전히 호출부에 있다.**

그래서 되돌렸다. 중요한 건 이거였다 — **이 코드도 의존성 주입이다.**
`ImagePlane`은 `sceneManager`와 `resourcesManager`를 **생성자로 받는다.**
전역에서 꺼내지 않고, 숨기지 않는다. 컨테이너를 안 쓸 뿐이다.

컨테이너는 목적이 아니라 **의존성 그래프가 깊을 때 배선을 대신해주는 도구**다.
그래프가 얕고 설정값이 인스턴스마다 다르면 손으로 `new` 하는 게 낫다.

---

## 7. 커밋 메시지에 남은 사고과정

이 리팩토링은 한 번에 된 게 아니라 8개 커밋에 걸쳐 진행됐고,
각 커밋 메시지에 그때의 고민이 남아 있다.

| 커밋 | 그때의 고민 |
|---|---|
| `c595942` | "핵심 인프라가 모델과 메인 클래스에 직접 결합되어 있어 **성능 최적화와 엔진 기능 변경이 어려웠던** 문제" → `IPhysicsService`, `ISceneManager` 도입 |
| `5bf78ce` | "단일 클래스 내에 물리·비행 제어·이펙트가 혼재되어 **'God Object'화 되어가던** 구조" → `SpaceShip`에서 `GameContext` 제거 |
| `705def9` | "`BaseModel`은 모든 모델에 `GameContext`를 주입하여 **시스템 전체가 서로 얽히는** 문제" → `ResourceModel` 도입 |
| `3c230c6` | "게임 로직 내 **직접적 DOM 조작을 제거**하여 UI와 비즈니스 로직 간 결합도 해소" → EventBus 기반 UI |
| `ed2c58d` | "`@injectable` 클래스로 전환하여 **전역 의존성 해소**" → Audio |
| `6ae95fc` | "거대 `GameContext` 의존성을 완전히 제거하고 **필요한 서비스만** 생성자 주입" → ProjectOutpost |
| `99565a6` | "`Game.ts`가 거대한 데이터를 직접 처리하지 않도록" → Thin Orchestrator |
| `0f8c0bb` | "불필요해진 거대한 GameContext 제거" ← **여기서 파일이 삭제된다** |

순서가 중요하다. `GameContext.ts`를 **먼저 지우고 나머지를 고친 게 아니라**,
소비자를 하나씩 떼어낸 뒤 마지막에 빈 껍데기를 지웠다.
`0f8c0bb`의 diff가 `43 deletions` 한 줄뿐인 건 그래서다 — 그 시점엔 아무도 안 쓰고 있었다.

---

## 8. 솔직하게: 아직 안 끝났다

글의 앞부분만 읽으면 깔끔하게 끝난 것처럼 보이는데, 코드를 다시 훑어보니 그렇지 않다.

### 8-1. Service Locator가 디버그 계층에 그대로 살아 있다

```console
$ grep -rn "TweakPane.getInstance()" src --include=*.ts
9개 파일, 10곳
```

```ts
// src/Debug/TweakPane.ts
export class TweakPane extends Pane {
    private static instance: TweakPane
    static getInstance(options?: PaneConfig): TweakPane { /* ... */ }
}
```

```ts
// src/Models/Floor/Floor.ts:226
const pane = TweakPane.getInstance()
```

`ServiceRegistry`와 **구조적으로 같은 것**이다. 전역 싱글턴을 메서드 안에서 꺼낸다.
`Floor`, `Grass`, `Camera`, `Rendering`, `Lighting`, `TerrainVisibilityArea`,
`SpaceShipDebugger`, `EngineFlame`, `RockModels`가 전부 여기 해당한다.

즉 **"Service Locator를 걷어냈다"는 주장은 프로덕션 경로에 한해서만 참이다.**
디버그 경로는 여전히 블랙박스다.
`Floor.setUpTweakPane()`을 읽기 전까지 `Floor`가 `TweakPane`에 의존한다는 사실은 시그니처에 안 나온다.

변명하자면 디버그 코드라 우선순위를 낮췄다. 하지만 그건 그냥 안 한 것이지 해결한 게 아니다.

### 8-2. 정적 컨텍스트가 머티리얼 계층에 남아 있다

```ts
// src/Materials/MeshDefaultMaterial.ts
interface MeshDefaultMaterialContext {
    lighting: Lighting
    terrian: Floor
    fog: FixedNightFog
}
```

```ts
// src/core/GameBootstrapper.ts
MeshDefaultMaterial.setup({
    lighting: this.lighting,
    terrian: this.worldManager.terrain,
    fog: this.environmentManager.fog,
})
```

이름부터 `Context`다. **거대 컨텍스트의 축소판이 살아남았다.**
정적 메서드로 전역 상태를 세팅하니 DI 그래프 바깥에 있고,
`setup()`을 부르기 전에 머티리얼을 만들면 런타임에 터진다 — 3장에서 문제 삼았던 그 실패 양상 그대로다.

필드가 3개라 아직 견딜 만하다는 게 유일한 방어 논리인데, `GameContext`도 처음엔 3개였을 것이다.

### 8-3. DI가 못 잡는 의존성: DOM

```ts
// src/UI/Notification.ts
@injectable()
export class Notification {
    constructor() {                                   // ← 의존성 0으로 보인다
        this.messageElement = document.querySelector(".toast-message") as HTMLParagraphElement
        const closeBtn = document.querySelector(".toast-close-btn")
        // ...
    }
}
```

생성자는 비어 있지만 실제로는 `index.html`의 특정 클래스명에 강하게 결합돼 있다.
`.toast-message`를 HTML에서 지우면 조용히 `null`이 되고 나중에 터진다.
`Audio.ts`에 11곳, `Entry.ts`에 여러 곳 같은 패턴이 있다.

**DI는 "객체 의존성"을 드러낼 뿐 "환경 의존성"은 못 드러낸다.**
5장에서 "생성자 시그니처를 믿을 수 있게 됐다"고 썼는데, DOM에 대해서는 아직 아니다.

### 8-4. 선언과 실제가 다른 리팩토링

커밋 `f2d1112`는 "ProjectRegistry의 데이터 중심 관리 및 **DI 싱글톤 전환**"이라고 되어 있다.
실제 코드는 이렇다.

```ts
// src/core/ProjectRegistry.ts
export class Project {
    private projects: ProjectData[] = []
    private constructor() { this.initializeDefaultProjects() }   // ← private, static factory 없음
}
```

- DI 모듈 어디에도 바인딩되어 있지 않다
- `private constructor`에 static factory가 없어 **인스턴스화가 불가능하다**
- 프로젝트 데이터는 `ProjectManager.ts`가 **하드코딩으로 다시 갖고 있다**
- `ProjectData` 인터페이스도 두 파일에 **중복 정의**되어 있다

즉 이 커밋은 절반만 됐고, 커밋 메시지는 완료된 것처럼 적혀 있다.
지금 살아 있는 건 타입 정의(`ProjectData`)뿐이고 `Project` 클래스는 죽은 코드다.

### 8-5. 남은 잔해

| 파일 | 상태 |
|---|---|
| `src/core/ServiceRegistry.ts` | 참조 0. Service Locator 시절 잔재 |
| `src/Manager/UIManager.ts` | 참조 0 |
| `src/Manager/GameEventManager.ts` | 참조 0 |
| `src/core/ProjectRegistry.ts` | `Project` 클래스 인스턴스화 불가 |
| `src/core/DI/ModelModule.ts:19` | `console.log("DIModels Debug:", ...)` 디버그 로그 잔존 |
| `README.md` | "ServiceRegistry 패턴으로 등록/조회" — **현재 사실 아님** |

README가 특히 문제다. 지금 이 리포지토리를 처음 보는 사람은
"공통 서비스는 ServiceRegistry를 통해 등록/조회되며"를 읽고 실제와 정반대의 그림을 갖게 된다.

### 8-6. 그리고 히스토리에 없는 단계

현재 리포지토리의 최초 커밋(`243b1bd`)은 이미 DI가 들어간 상태의 스쿼시 커밋이다.
`ServiceRegistry.ts`는 그 시점에 **이미 참조 0**인 채로 파일만 남아 있었다.

즉 **Service Locator 단계는 코드 화석으로만 뒷받침되고 커밋으로는 증명되지 않는다.**
`GameContext` → DI 전환은 8개 커밋으로 남아 있지만, 그 앞 단계는 남기지 못했다.

---

## 9. 무엇을 배웠나

세 단계를 거치고 나서 보니, 매번 같은 질문에 답하고 있었다.

> **"이 코드를 고치면 어디가 깨지는가?"**

- **거대 컨텍스트**: 알 수 없다. 전부 확인해야 한다.
- **Service Locator**: 알 수 없다. 확인할 코드의 양만 줄었다.
- **DIContainer**: 토큰을 검색하면 나온다.
- **TweakPane / MeshDefaultMaterial / DOM**: 여전히 알 수 없다.

의존성 주입의 가치는 "결합도를 낮춘다" 같은 문장이 아니라
**변경 영향 범위를 기계가 계산할 수 있게 만든다**는 데 있었다.
`@inject` 154개는 그 대가로 치른 보일러플레이트고, 남는 장사였다고 생각한다.

세 가지를 덧붙인다.

**첫째, 도구가 아니라 성질을 골라야 한다.**
Inversify를 쓴 게 문제를 푼 게 아니다. **"의존성을 숨길 수 있는 자리를 없앤 것"** 이 풀었다.
그 증거가 8-1이다 — 같은 프로젝트, 같은 컨테이너 안에서도 `getInstance()`를 허용한 계층은
그대로 블랙박스다. 라이브러리는 성질을 강제해주지 않는다. 규율이 강제한다.

**둘째, DI가 드러내 준 문제는 DI가 풀어주지 않는다.**
`Game`과 `GameBootstrapper`가 각각 12개씩 의존성을 갖는 건
그 둘이 너무 많은 걸 조율하고 있다는 신호다. DI는 그걸 **감추지 않고 보여줬을 뿐**이다.
다만 생성자 파라미터 개수가 설계 냄새의 지표가 됐다는 것 자체가
이전 구조에서는 불가능했던 일이니, 그건 그것대로 소득이다.

**셋째, 커밋 메시지는 완료 선언이 아니라 의도 기록이어야 한다.**
8-4가 그 반례다. "DI 싱글톤 전환"이라고 적어 두고 실제로는 바인딩하지 않았다.
나중에 이 히스토리를 읽는 사람(대개 나 자신)이 코드를 안 열어보면 잘못된 그림을 갖는다.

### 다음에 할 것

1. `README.md`의 ServiceRegistry 서술 수정 — **거짓 정보라 가장 급하다**
2. 죽은 파일 4개 삭제 (`ServiceRegistry`, `UIManager`, `GameEventManager`, `Project` 클래스)
3. `ProjectData` 중복 정의 통합
4. `ModelModule.ts`의 디버그 `console.log` 제거
5. `MeshDefaultMaterial`의 정적 컨텍스트를 DI 바인딩으로 전환
6. `TweakPane`을 `IDebugPane` 인터페이스로 감싸 주입 — 규모가 커서 마지막

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
| `TweakPane.getInstance()` 호출 지점 | **10** (9개 파일) ← 미해결 |
| `GameContext` 필드 (삭제 전) | 14 |
| 서비스 인터페이스 | 4 (`ISceneManager`, `IResourceService`, `IPhysicsService`, `IGameObject`) |
| 참조 0인 파일 | 3 (+ 인스턴스화 불가 클래스 1) |

### 주요 파일

```
src/main.ts                       Composition Root — 유일한 DIContainer.get()
src/core/DI/inversify.config.ts   컨테이너 조립 + 계층 순서
src/core/DI/DITypes.ts            Symbol 토큰 64개
src/core/DI/*Module.ts            계층별 바인딩 (8개)
src/Models/ResourceModel.ts       모델 공통 인프라
src/Services/I*.ts                서비스 인터페이스
src/core/EventBus/EventBus.ts     런타임 통신

src/Debug/TweakPane.ts            ← Service Locator 잔존 (미해결)
src/Materials/MeshDefaultMaterial.ts  ← 정적 컨텍스트 잔존 (미해결)
src/core/ServiceRegistry.ts       ← 죽은 코드
```

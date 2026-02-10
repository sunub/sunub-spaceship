# 🛠️ 리팩토링 및 인터랙션 데이터 흐름 분석 보고서

**작성일:** 2026-02-04  
**작성자:** Lead Frontend Developer (AI)  
**주제:** SpaceShip-JoyStick 의존성 분리 및 입력 시스템 개선

---

## 1. 아키텍처 리팩토링: 의존성 주입(DI) 적용

### 1-1. 문제점 분석 (AS-IS)
기존 코드에서는 **Entity(SpaceShip)**가 **UI Controller(JoyStick)**의 생성과 생명주기를 직접 관리하고 있었습니다.

```typescript
// ❌ 기존 방식 (강한 결합)
class SpaceShip {
    public joyStick: JoyStick;

    constructor() {
        // SpaceShip이 JoyStick의 구체적인 구현(Concretion)에 직접 의존함
        this.joyStick = new JoyStick(); 
    }
}
```

**발생했던 문제점:**
1.  **SRP(단일 책임 원칙) 위반:** `SpaceShip`은 우주선의 이동과 물리(Physics)를 담당해야 하지만, UI 입력 도구인 `JoyStick`의 생성까지 책임지고 있었습니다.
2.  **확장성 부재:** 만약 모바일 환경이 아닌 데스크탑 환경이라 `JoyStick` 대신 `KeyboardOnlyController`를 쓰고 싶어도, 코드를 직접 수정하지 않는 한 교체가 불가능합니다.
3.  **테스트 용이성 저하:** `JoyStick`은 DOM 요소(Canvas, HTML)에 의존합니다. `SpaceShip`을 테스트하려 할 때마다 DOM 환경이 강제되는 부작용이 있었습니다.

### 1-2. 해결 전략: 제어의 역전 (Inversion of Control)
이 문제를 해결하기 위해 **의존성 주입(Dependency Injection)** 패턴을 적용했습니다. 객체가 의존성을 직접 생성하는 대신, 외부(Container)로부터 주입받도록 변경했습니다.

**필요했던 핵심 요소:**
*   **DI Container:** 객체들의 생성과 관계를 관리하는 중앙 저장소 (InversifyJS 사용)
*   **Symbol 식별자:** `GAME_CONTEXT.JoyStick`, `GAME_CONTEXT.SpaceShip` 등 고유 키값
*   **Injectable Decorator:** 클래스가 주입 가능하다는 것을 명시 (`@injectable`)

### 1-3. 개선된 구조 (TO-BE)

**변경 1: JoyStick 독립 서비스화**
`JoyStick`을 `SpaceShip`의 부속품이 아닌, `GameContext` 내의 독립적인 서비스로 승격시켰습니다.

```typescript
@injectable()
export class JoyStick { ... }
```

**변경 2: 생성자 주입 (Constructor Injection)**
`SpaceShip`은 이제 자신이 무엇을 사용하는지 알 필요가 없습니다. 단지 "JoyStick 기능을 수행하는 무언가"를 받을 뿐입니다.

```typescript
// ✅ 개선된 방식 (느슨한 결합)
@injectable()
export class SpaceShip {
    // 컨테이너가 알아서 인스턴스를 주입해줌
    constructor(@inject(GAME_CONTEXT.JoyStick) public joyStick: JoyStick) {
        ...
    }
}
```

**변경 3: Game 클래스 위임**
`Game` 클래스 또한 `new SpaceShip()`을 호출하지 않고, 이미 조립이 완료된 `SpaceShip` 인스턴스를 컨테이너로부터 받아서 사용합니다.

```typescript
@injectable()
export class Game {
    @inject(GAME_CONTEXT.SpaceShip) public spaceShip!: SpaceShip;
    // ...
}
```

---

## 2. 인터랙션 데이터 흐름 및 포커스 문제 해결

### 2-1. 문제 상황 (Focus Trapping)
사용자가 `TerminalOverlay`와 상호작용 후 게임으로 돌아왔을 때, 키보드 입력("E" 키 등)이 먹통이 되는 현상이 발생했습니다.

**원인 분석:**
1.  **Overlay Open:** 사용자가 터미널을 염.
2.  **Interaction:** "Back to Flight" 버튼을 클릭함.
3.  **Focus Shift:** 브라우저의 포커스(Focus)가 `Canvas`에서 방금 클릭한 `HTMLButtonElement`로 이동함.
4.  **Event Loss:** 기존 `InputManager`는 `canvas.addEventListener('keydown')`만 듣고 있었음. 포커스가 버튼에 가 있으므로 캔버스에는 이벤트가 전파되지 않음.

### 2-2. 데이터 흐름 개선 (Data Flow Diagram)

이 문제를 해결하기 위해 입력 감지 범위를 전역으로 확장하고, 명시적인 포커스 관리를 도입했습니다.

#### [Before Fix]
```mermaid
User Input (Key "E") 
    │
    ▼
[Document Body / Button] (Current Focus)
    │
    ❌ (Event does not reach Canvas)
    │
[Canvas Element] (Listener attached here)
    │
[InputManager] (Idle...)
```

#### [After Fix]
```mermaid
User Input (Key "E") 
    │
    ▼
[Window / Document] (Global Listener)
    │
    ✅ (Event Captured via Bubbling)
    │
[InputManager] 
    │ "KeyE" Detected
    ▼
[Game Logic]
    │ Handle Interaction()
    ▼
[Overlay Handling]
    │ If Closing Overlay:
    │ 1. Hide UI
    │ 2. canvas.focus() (Force Focus Return)
    ▼
[Game Loop Resumed]
```

### 2-3. 주요 해결 기법

1.  **Global Event Listening:**
    입력의 신뢰성을 보장하기 위해 리스너 대상을 `canvas`에서 `window`로 변경했습니다.
    ```typescript
    // InputManager.ts
    window.addEventListener("keydown", ...) 
    // 이제 포커스가 어디에 있든 게임 키 입력을 감지함
    ```

2.  **Explicit Focus Restoration:**
    UX 측면에서, UI가 닫힐 때 명시적으로 게임 화면(Canvas)으로 포커스를 돌려놓아야 다음 조작(이동 등)이 즉시 가능합니다.
    ```typescript
    // TerminalOverlay.ts
    public hide() {
        ...
        // UI가 닫히는 즉시 캔버스로 포커스 복구
        this.context.rendering.renderer.domElement.focus();
    }
    ```

---

## 3. 결론

이번 작업을 통해 두 가지 핵심적인 개선을 이루어냈습니다.

1.  **구조적 건전성 확보:** 강하게 결합되어 있던 Entity와 Controller를 분리하여, 향후 컨트롤러 교체(예: 게임패드 지원, 모바일 터치 전용 등)나 유닛 테스트 작성이 매우 용이해졌습니다.
2.  **사용자 경험(UX) 안정성:** DOM 요소와 Canvas 간의 포커스 이동으로 인한 입력 끊김 현상을 근본적으로 해결하여, 끊김 없는(Seamless) 게임 플레이 흐름을 보장했습니다.

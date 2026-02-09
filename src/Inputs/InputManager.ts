import { inject, injectable } from "inversify";
import type {
    ActionType,
    InputConfig,
    KeyboardKeys,
    MouseState,
    TouchState,
} from "./types";
import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { DOMManager } from "@/core/DOMManger";
import { EventBus } from "@/core/EventBus/EventBus";
import { GameEvents } from "@/core/EventBus/EventBusType";

type InputListener = (active: boolean) => void;

@injectable()
export class InputManager {
    private isLocked: boolean = false;

    // 키보드 설정
    private config: InputConfig = {
        MoveForward: ["KeyW", "ArrowUp"],
        MoveBackward: ["KeyS", "ArrowDown"],
        TurnLeft: ["KeyA", "ArrowLeft"],
        TurnRight: ["KeyD", "ArrowRight"],
        Interact: ["KeyE"],
    };

    // 조이스틱용 (모바일 터치)
    private touchState: TouchState = {
        isDown: false,
        x: 0,
        y: 0,
        screenX: 0,
        screenY: 0,
    };

    // 카메라용 (PC 마우스)
    private mouseState: MouseState = {
        isDown: false,
        x: 0,
        y: 0,
        deltaX: 0,
        deltaY: 0,
        screenX: 0,
        screenY: 0,
    };

    private pressedKeys = new Set<KeyboardKeys>();
    private listeners = new Map<ActionType, Set<InputListener>>();
    private disposables: Array<() => void> = [];

    constructor(
        @inject(GAME_CONTEXT.MANAGER.DOMManager) private domManager: DOMManager,
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {
        this.setupEventListeners();
        this.setupTouchListeners();
        this.setupMouseListeners();
        this.setupVisibilityChangeListener();
        this.setupResizeEvent();
    }

    private setupTouchListeners() {
        const { canvas } = this.domManager;

        canvas.addEventListener(
            "touchstart",
            (e) => {
                if (this.isLocked) return;
                this.touchState.isDown = true;
                this.updateTouchInfo(e);
            },
            { passive: false },
        );

        canvas.addEventListener(
            "touchmove",
            (e) => {
                if (this.isLocked) return;
                this.updateTouchInfo(e);
            },
            { passive: false },
        );

        const handleTouchEnd = () => {
            if (this.isLocked) return;
            this.touchState.isDown = false;
        };

        canvas.addEventListener("touchend", handleTouchEnd);
        canvas.addEventListener("touchcancel", handleTouchEnd);
        canvas.addEventListener("touchleave", handleTouchEnd);
    }

    private updateTouchInfo(e: TouchEvent) {
        if (e.touches.length > 0) {
            const t = e.touches[0];
            this.touchState.screenX = t.clientX;
            this.touchState.screenY = t.clientY;
            this.touchState.x = (t.clientX / window.innerWidth) * 2 - 1;
            this.touchState.y = -(t.clientY / window.innerHeight) * 2 + 1;
        }
    }

    private setupMouseListeners() {
        const { canvas } = this.domManager;

        canvas.addEventListener("mousedown", (e) => {
            if (this.isLocked) return;
            this.mouseState.isDown = true;
            this.updateMouseInfo(e, true);
        });

        window.addEventListener("mousemove", (e) => {
            if (this.isLocked) return;
            this.updateMouseInfo(e);
        });
        window.addEventListener("mouseup", () => {
            if (this.isLocked) return;
            this.mouseState.isDown = false;
            this.mouseState.deltaX = 0;
            this.mouseState.deltaY = 0;
        });
    }

    private setupVisibilityChangeListener() {
        document.addEventListener(
            "visibilitychange",
            this.handleVisibilityChange.bind(this),
        );
    }

    private setupResizeEvent() {
        window.addEventListener("resize", this.handleResizeEvent.bind(this));
    }

    private handleResizeEvent() {
        this.eventBus.emit(GameEvents.RESIZE, {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: window.devicePixelRatio,
        });
    }

    private handleVisibilityChange() {
        if (document.visibilityState === "hidden") {
            this.eventBus.emit(GameEvents.GAME_VISIBILITY_HIDDEN, undefined);
        } else {
            this.eventBus.emit(GameEvents.GAME_VISIBILITY_VISIBLE, undefined);
        }
    }

    private updateMouseInfo(e: MouseEvent, isStart: boolean = false) {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;

        if (isStart) {
            this.mouseState.deltaX = 0;
            this.mouseState.deltaY = 0;
        } else {
            this.mouseState.deltaX = x - this.mouseState.x;
            this.mouseState.deltaY = y - this.mouseState.y;
        }

        this.mouseState.x = x;
        this.mouseState.y = y;
        this.mouseState.screenX = e.clientX;
        this.mouseState.screenY = e.clientY;
    }

    private setupEventListeners() {
        window.addEventListener("keydown", (e) =>
            this.handleKey(e.code as KeyboardKeys, true),
        );
        window.addEventListener("keyup", (e) =>
            this.handleKey(e.code as KeyboardKeys, false),
        );
        window.addEventListener("blur", () => this.pressedKeys.clear());
    }

    private handleKey(key: KeyboardKeys, isPressed: boolean) {
        if (this.isLocked) {
            return;
        }

        if (isPressed) {
            this.pressedKeys.add(key);
        } else {
            this.pressedKeys.delete(key);
        }

        for (const [action, keys] of Object.entries(this.config)) {
            if (keys.includes(key)) {
                this.listeners.get(action as ActionType)?.forEach((cb) => {
                    cb(isPressed);
                });
            }
        }
    }

    public isAction(action: ActionType) {
        if (this.isLocked) {
            return false;
        }

        return this.config[action].some((key) => this.pressedKeys.has(key));
    }

    public getTouchState(): Readonly<TouchState> {
        return this.touchState;
    }

    public getMouseState(): Readonly<MouseState> {
        return this.mouseState;
    }

    public subscribe(action: ActionType, callback: InputListener) {
        if (!this.listeners.has(action)) {
            this.listeners.set(action, new Set());
        }
        this.listeners.get(action)?.add(callback);

        return () => this.listeners.get(action)?.delete(callback);
    }

    public lock() {
        this.isLocked = true;
        this.pressedKeys.clear();
    }

    public unlock() {
        this.isLocked = false;
    }

    public dispose() {
        this.disposables.forEach((dispose) => dispose());
        this.disposables = [];
    }
}

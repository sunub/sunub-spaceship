import { inject, injectable } from "inversify"
import type { ActionType, InputConfig, KeyboardKeys, PointerState } from "./types"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { DOMManager } from "@/core/DOMManger"

type InputListener = (active: boolean) => void

@injectable()
export class InputManager {
    private isLocked: boolean = false

    // 키보드 설정
    private config: InputConfig = {
        MoveForward: ["KeyW", "ArrowUp"],
        MoveBackward: ["KeyS", "ArrowDown"],
        TurnLeft: ["KeyA", "ArrowLeft"],
        TurnRight: ["KeyD", "ArrowRight"],
        Interact: ["KeyE"],
    }

    // 포인터 설정
    private pointer: PointerState = {
        isDown: false,
        x: 0,
        y: 0,
        screenX: 0,
        screenY: 0,
    }

    private pressedKeys = new Set<KeyboardKeys>()
    private listeners = new Map<ActionType, Set<InputListener>>()

    constructor(
        @inject(GAME_CONTEXT.DOMManager) private domManager: DOMManager,
    ) {
        this.setupEventListeners()
        this.setupPointerListeners()
    }

    private setupPointerListeners() {
        const { canvas } = this.domManager
        canvas.addEventListener("pointerdown", (e) => {
            if (this.isLocked) {
                return
            }
            this.pointer.isDown = true
            this.updatePointerInfo(e);
        })
        canvas.addEventListener("pointermove", (e) => {
            if (this.isLocked) {
                return
            }
            this.updatePointerInfo(e);
        })

        const endHandler = () => {
            if (this.isLocked) {
                return
            }
            this.pointer.isDown = false;
        }
        canvas.addEventListener("pointerup", endHandler)
        canvas.addEventListener("pointerleave", endHandler)
        canvas.addEventListener("pointercancel", endHandler)
    }

     private updatePointerInfo(e: PointerEvent) {
        this.pointer.screenX = e.clientX;
        this.pointer.screenY = e.clientY;
        
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    private setupEventListeners() {
        window.addEventListener("keydown", (e) =>
            this.handleKey(e.code as KeyboardKeys, true),
        )
        window.addEventListener("keyup", (e) =>
            this.handleKey(e.code as KeyboardKeys, false),
        )
        window.addEventListener("blur", () => this.pressedKeys.clear())
    }

    private handleKey(key: KeyboardKeys, isPressed: boolean) {
        if (this.isLocked) {
            return
        }

        if (isPressed) {
            this.pressedKeys.add(key)
        } else {
            this.pressedKeys.delete(key)
        }

        for (const [action, keys] of Object.entries(this.config)) {
            if (keys.includes(key)) {
                this.listeners.get(action as ActionType)?.forEach((cb) => {
                    cb(isPressed)
                })
            }
        }
    }

    public isAction(action: ActionType) {
        if (this.isLocked) {
            return false
        }

        return this.config[action].some((key) => this.pressedKeys.has(key))
    }

     public getPointerState(): Readonly<PointerState> {
        return this.pointer;
    }

    public subscribe(action: ActionType, callback: InputListener) {
        if (!this.listeners.has(action)) {
            this.listeners.set(action, new Set())
        }
        this.listeners.get(action)?.add(callback)

        return () => this.listeners.get(action)?.delete(callback)
    }

    public lock() {
        this.isLocked = true
        this.pressedKeys.clear()
    }

    public unlock() {
        this.isLocked = false
    }
}

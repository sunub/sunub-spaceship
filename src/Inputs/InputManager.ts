import type {
    ActionType,
    InputConfig,
    KeyboardKeys,
} from "./types"

type InputListener = (active: boolean) => void

export class InputManager {
    private static instance: InputManager
    private isLocked: boolean = false

    private config: InputConfig = {
        MoveForward: ["KeyW", "ArrowUp"],
        MoveBackward: ["KeyS", "ArrowDown"],
        TurnLeft: ["KeyA", "ArrowLeft"],
        TurnRight: ["KeyD", "ArrowRight"],
        Interact: ["KeyE"], 
    }

    private pressedKeys = new Set<KeyboardKeys>()
    private listeners = new Map<ActionType, Set<InputListener>>()

    static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager()
        }
        return InputManager.instance
    }

    constructor() {
        this.setupEventListeners()
    }

    private setupEventListeners() {
        window.addEventListener("keydown", (e) => this.handleKey(e.code as KeyboardKeys, true))
        window.addEventListener("keyup", (e) => this.handleKey(e.code as KeyboardKeys, false))
        window.addEventListener("blur", () => this.pressedKeys.clear())
    }

    private handleKey(key: KeyboardKeys, isPressed: boolean) {
        if(this.isLocked) {
            return
        }

        if(isPressed) {
            this.pressedKeys.add(key)
        } else {
            this.pressedKeys.delete(key)
        }

        for(const [action, keys] of Object.entries(this.config)) {
            if(keys.includes(key)) {
                this.listeners.get(action as ActionType)?.forEach(cb => cb(isPressed))
            }
        }
    }

    public isAction(action: ActionType) {
        if(this.isLocked) {
            return false
        }

        return this.config[action].some(key => this.pressedKeys.has(key))
    }

    public subscribe(action: ActionType, callback: InputListener) {
        if(!this.listeners.has(action)) {
            this.listeners.set(action, new Set());
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

import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"
import EventEmitter from "./EventEmitter"

@injectable()
export default class Time extends EventEmitter {
    start: number
    current: number
    elapsed: number
    delta: number
    private isRunning = false
    private animationId: number | null = null
    private disposables: Array<() => void> = []

    constructor(
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {
        super()

        this.start = performance.now()
        this.current = 0
        this.elapsed = 0
        this.delta = 16

        // 자동으로 시작하지 않음 - Game.start()에서 명시적으로 시작
    }

    update(currentTime: number) {
        const rawDelta = currentTime - this.current
        // Smooth delta to prevent jitter
        this.delta += (rawDelta - this.delta) * 0.1

        this.current = currentTime
        this.elapsed = currentTime

        this.trigger("tick")
    }

    startGameLoop() {
        if (this.isRunning) {
            return
        }

        this.isRunning = true
        this.animationId = window.requestAnimationFrame(() => {
            this.tick()
        })
    }

    stopGameLoop() {
        this.isRunning = false
        if (this.animationId) {
            window.cancelAnimationFrame(this.animationId)
            this.animationId = null
        }
    }

    tick() {
        if (!this.isRunning) {
            return
        }

        const currentTime = performance.now()
        const rawDelta = currentTime - this.current
        this.delta += (rawDelta - this.delta) * 0.1

        this.current = currentTime
        this.elapsed = this.current - this.start

        this.trigger("tick")

        this.animationId = window.requestAnimationFrame(() => {
            this.tick()
        })
    }

    public setupVisibilityEvents() {
        const unscribeHidden = this.eventBus.on(
            GameEvents.GAME_VISIBILITY_HIDDEN,
            () => {
                this.stopGameLoop()
            },
        )
        const unscribeVisible = this.eventBus.on(
            GameEvents.GAME_VISIBILITY_VISIBLE,
            () => {
                this.startGameLoop()
            },
        )

        this.disposables.push(unscribeHidden, unscribeVisible)
    }

    public reset(currentTime: number) {
        this.current = currentTime - 16.67
        this.elapsed = currentTime
        this.delta = 16.67
    }

    public dispose() {
        this.disposables.forEach((dispose) => {
            dispose()
        })
        this.disposables = []
    }
}

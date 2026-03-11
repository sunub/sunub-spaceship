import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { EventBus } from "@/core/EventBus/EventBus";
import { GameEvents } from "@/core/EventBus/EventBusType";
import { inject, injectable } from "inversify";

@injectable()
export class InputIndicator {
    private disposables: Array<() => void> = [];
    private keyW: HTMLElement | null = null;
    private keyA: HTMLElement | null = null;
    private keyS: HTMLElement | null = null;
    private keyD: HTMLElement | null = null;

    constructor(
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {}

    public initialize(): void {
        this.keyW = document.getElementById("key-w");
        this.keyA = document.getElementById("key-a");
        this.keyS = document.getElementById("key-s");
        this.keyD = document.getElementById("key-d");

        const unsubscribe = this.eventBus.on(
            GameEvents.KEYBOARD_INPUT,
            ({ roll, thrust }) => this.updateDOM(roll, thrust),
        );
        this.disposables.push(unsubscribe);
    }

    private updateDOM(roll: number, thrust: number): void {
        this.keyW?.classList.toggle("active", thrust > 0.1);
        this.keyA?.classList.toggle("active", roll < -0.1);
        this.keyS?.classList.toggle("active", thrust < -0.1);
        this.keyD?.classList.toggle("active", roll > 0.1);
    }

    public dispose(): void {
        this.disposables.forEach((dispose) => dispose());
        this.disposables = [];
    }
}

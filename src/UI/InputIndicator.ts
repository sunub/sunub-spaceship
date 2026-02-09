import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { EventBus } from "@/core/EventBus/EventBus";
import { GameEvents } from "@/core/EventBus/EventBusType";
import { inject, injectable } from "inversify";

@injectable()
export class InputIndicator {
    private disposables: Array<() => void> = [];

    constructor(
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {}

    public initialize(): void {
        const unsubscribe = this.eventBus.on(
            GameEvents.KEYBOARD_INPUT,
            ({ roll, thrust }) => this.updateDOM(roll, thrust),
        );
        this.disposables.push(unsubscribe);
    }

    private updateDOM(roll: number, thrust: number): void {
        const keyW = document.getElementById("key-w");
        const keyA = document.getElementById("key-a");
        const keyS = document.getElementById("key-s");
        const keyD = document.getElementById("key-d");

        if (keyW) keyW.classList.toggle("active", thrust > 0.1);
        if (keyA) keyA.classList.toggle("active", roll < -0.1);
        if (keyS) keyS.classList.toggle("active", thrust < -0.1);
        if (keyD) keyD.classList.toggle("active", roll > 0.1);
    }

    public dispose(): void {
        this.disposables.forEach((dispose) => dispose());
        this.disposables = [];
    }
}


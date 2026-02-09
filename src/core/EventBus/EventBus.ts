import { injectable } from "inversify";
import type { EventKey, EventHandler, GameEventPayloads } from "./EventBusType"

@injectable()
export class EventBus {
    private handlers: Map<EventKey, Set<EventHandler<any>>> = new Map();

    public emit<K extends EventKey>(key: K, payload: GameEventPayloads[K]): void {
        const handlers = this.handlers.get(key);
        if (handlers) {
            handlers.forEach(handler => handler(payload));
        }
    }

    /**
     * 이벤트를 구독합니다.
     * @returns 구독을 해제하는 함수(unsubscribe function)를 반환합니다.
     */
    public on<K extends EventKey>(key: K, handler: EventHandler<K>): () => void {
        if (!this.handlers.has(key)) {
            this.handlers.set(key, new Set());
        }

        const handlers = this.handlers.get(key)!;
        handlers.add(handler);

        // 클로저를 활용해 해제 함수를 바로 반환합니다.
        // 사용자는 off를 호출하기 위해 함수 참조를 따로 저장할 필요가 없습니다.
        return () => {
            handlers.delete(handler);
        };
    }
    
    public clear(key?: EventKey): void {
        if (key) {
            this.handlers.delete(key);
        } else {
            this.handlers.clear();
        }
    }
}
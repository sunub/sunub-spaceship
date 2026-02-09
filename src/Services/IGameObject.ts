export interface IGameObject {
    initialize?(addToScene: boolean): void | Promise<void>
    update(deltaTime: number, alpha?: number): void
    updatePhysics?(deltaTime: number): void
    dispose?(): void
}
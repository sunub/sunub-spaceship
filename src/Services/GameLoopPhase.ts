export type GameLoopPhaseName =
    | "lighting"
    | "physics"
    | "entry"
    | "visibility"
    | "logic"
    | "camera"
    | "physicsDebug"
    | "render"
    | "cssRender"

export interface GameLoopPhaseContext {
    deltaTime: number
    isFullMode: boolean
    isTransitioning: boolean
    entryDisposed: boolean
}

export interface GameLoopPhaseDefinition {
    name: GameLoopPhaseName
    shouldRun?: (context: GameLoopPhaseContext) => boolean
    run: (context: GameLoopPhaseContext) => void | Promise<void>
}

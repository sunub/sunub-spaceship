import type { RigidBody } from "@dimforge/rapier3d-compat"
import type { ProjectData } from "../ProjectRegistry"

export type ResizeEvent = {
    width: number
    height: number
    pixelRatio: number
}

export const GameEvents = {
    TERMINAL_OPENED: "UI:TerminalOpened",
    TERMINAL_CLOSED: "UI:TerminalClosed",
    PLAYER_READY: "Game:PlayerReady",
    GAME_PAUSED: "Game:Paused",
    GAME_RESUMED: "Game:Resumed",
    GAME_VISIBILITY_HIDDEN: "Game:VisibilityHidden",
    GAME_VISIBILITY_VISIBLE: "Game:VisibilityVisible",
    PROJECT_INTERACTION_REQUESTED: "Project:InteractionRequested",
    RESIZE: "Game:Resize",
    KEYBOARD_INPUT: "Input:KeyboardInput",
    ENTRY_DISPOSED: "Entry:Disposed",
} as const

export interface GameEventPayloads {
    [GameEvents.TERMINAL_OPENED]: undefined
    [GameEvents.TERMINAL_CLOSED]: undefined
    [GameEvents.PLAYER_READY]: {
        spaceshipRigidBody: RigidBody
    }
    [GameEvents.GAME_PAUSED]: { reason: string }
    [GameEvents.GAME_RESUMED]: undefined
    [GameEvents.GAME_VISIBILITY_HIDDEN]: undefined
    [GameEvents.GAME_VISIBILITY_VISIBLE]: undefined
    [GameEvents.PROJECT_INTERACTION_REQUESTED]: { project: ProjectData }
    [GameEvents.RESIZE]: ResizeEvent
    [GameEvents.KEYBOARD_INPUT]: { roll: number; thrust: number }
    [GameEvents.ENTRY_DISPOSED]: undefined
}

export type EventKey = keyof GameEventPayloads
export type EventHandler<T extends EventKey> = (
    payload: GameEventPayloads[T],
) => void

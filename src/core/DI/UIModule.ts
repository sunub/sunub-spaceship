import { ContainerModule } from "inversify"
import { InputIndicator } from "@/UI/InputIndicator"
import { Notification } from "@/UI/Notification"
import { TerminalOverlay } from "@/UI/TerminalOverlay"
import { GAME_CONTEXT } from "./DITypes"

export const UIModule = new ContainerModule(({ bind }) => {
    bind<InputIndicator>(GAME_CONTEXT.UI.InputIndicator)
        .to(InputIndicator)
        .inSingletonScope()

    bind<Notification>(GAME_CONTEXT.UI.Notification)
        .to(Notification)
        .inSingletonScope()

    bind<TerminalOverlay>(GAME_CONTEXT.UI.TerminalOverlay)
        .to(TerminalOverlay)
        .inSingletonScope()
})

import { ContainerModule } from "inversify"
import { Size } from "@/utils/Size"
import Time from "@/utils/Time"
import { GAME_CONTEXT } from "./DITypes"

export const UtilityModule = new ContainerModule((options) => {
    options.bind<Time>(GAME_CONTEXT.UTILITY.Time).to(Time).inSingletonScope()
    options.bind<Size>(GAME_CONTEXT.UTILITY.Size).to(Size).inSingletonScope()
})

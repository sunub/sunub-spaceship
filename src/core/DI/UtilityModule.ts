import { ContainerModule } from "inversify";
import Time from "@/utils/Time";
import { Size } from "@/utils/Size";
import { GAME_CONTEXT } from "./DITypes";

export const UtilityModule = new ContainerModule((options) => {
  options.bind<Time>(GAME_CONTEXT.UTILITY.Time).to(Time).inSingletonScope();
  options.bind<Size>(GAME_CONTEXT.UTILITY.Size).to(Size).inSingletonScope();
});
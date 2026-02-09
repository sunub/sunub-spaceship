import { ContainerModule } from "inversify";
import { GAME_CONTEXT } from "./DITypes";
import { GameBootstrapper } from "../GameBootstrapper";
import { CSSRenderer } from "@/core/CSSRenderer";
import { Lighting } from "@/core/Lighting";
import { Game } from "@/core/Game";
import { Physics } from "@/core/Physics";
import { Rendering } from "@/core/Rendering";
import { Audio } from "@/Environment/Audio";
import { Entry } from "../Entry/Entry";
import { Scene } from "@/core/Scene";
import { Camera } from "@/Camera";
import { EventBus } from "../EventBus/EventBus";

import { GameLoop } from "@/Services/GameLoop";

export const CoreModule = new ContainerModule(({bind}) => {
  bind<GameBootstrapper>(GAME_CONTEXT.CORE.GameBootstrapper).to(GameBootstrapper);
  bind<CSSRenderer>(GAME_CONTEXT.CORE.CSSRenderer).to(CSSRenderer).inSingletonScope();
  bind<Lighting>(GAME_CONTEXT.CORE.Lighting).to(Lighting).inSingletonScope();
  bind<Game>(GAME_CONTEXT.CORE.Game).to(Game).inSingletonScope();
  bind<Scene>(GAME_CONTEXT.CORE.Scene).to(Scene).inSingletonScope();
  bind<Camera>(GAME_CONTEXT.CORE.Camera).to(Camera).inSingletonScope();
  bind<Physics>(GAME_CONTEXT.CORE.Physics).to(Physics).inSingletonScope();
  bind<Rendering>(GAME_CONTEXT.CORE.Rendering).to(Rendering).inSingletonScope();
  bind<Audio>(GAME_CONTEXT.CORE.Audio).to(Audio).inSingletonScope();
  bind<Entry>(GAME_CONTEXT.CORE.Entry).to(Entry).inSingletonScope();
  bind<EventBus>(GAME_CONTEXT.CORE.EventBus).to(EventBus).inSingletonScope();
  bind<GameLoop>(GAME_CONTEXT.CORE.GameLoop).to(GameLoop).inSingletonScope();
});

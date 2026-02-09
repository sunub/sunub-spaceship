import { ContainerModule } from "inversify";
import { GAME_CONTEXT } from "./DITypes";
import { PhysicsService } from "@/Services/PhysicsService";
import { RaycastService } from "@/Services/RaycasterService";
import { Resources } from "@/utils/Resources";
import { TerrainVisibilityArea } from "@/Services/TerrainVisibilityArea";

export const ServiceModule = new ContainerModule(({bind}) => {
  bind<PhysicsService>(GAME_CONTEXT.SERVICE.PhysicsService).to(PhysicsService).inSingletonScope();
  bind<RaycastService>(GAME_CONTEXT.SERVICE.RaycasterService).to(RaycastService).inSingletonScope();
  bind<Resources>(GAME_CONTEXT.SERVICE.ResourceService).to(Resources).inSingletonScope();
  bind<TerrainVisibilityArea>(GAME_CONTEXT.SERVICE.TerrainVisibilityArea).to(TerrainVisibilityArea).inSingletonScope();
});

import { ContainerModule } from "inversify"
import { InputManager } from "@/Inputs/InputManager"
import { EnvironmentManager } from "@/Manager/EnvironmentManager"
import { ProjectManager } from "@/Manager/ProjectManager"
import { WorldManager } from "@/Manager/WorldManager"
import { SceneManager } from "@/Services/SceneManager"
import { DOMManager } from "../DOMManger"
import { GAME_CONTEXT } from "./DITypes"

export const ManagerModule = new ContainerModule(({ bind }) => {
    bind<DOMManager>(GAME_CONTEXT.MANAGER.DOMManager)
        .to(DOMManager)
        .inSingletonScope()
    bind<InputManager>(GAME_CONTEXT.MANAGER.InputManager)
        .to(InputManager)
        .inSingletonScope()
    bind<WorldManager>(GAME_CONTEXT.MANAGER.WorldManager)
        .to(WorldManager)
        .inSingletonScope()
    bind<SceneManager>(GAME_CONTEXT.MANAGER.SceneManager)
        .to(SceneManager)
        .inSingletonScope()
    bind<ProjectManager>(GAME_CONTEXT.MANAGER.ProjectManager)
        .to(ProjectManager)
        .inSingletonScope()
    bind<EnvironmentManager>(GAME_CONTEXT.MANAGER.EnvironmentManager)
        .to(EnvironmentManager)
        .inSingletonScope()
})

import { ContainerModule } from "inversify"
import {
    Birds,
    BrightCrystal,
    CrystalStructure,
    FloatCrystal,
    Floor,
    Github,
    Grass,
    Mountain,
    MountainOutliner,
    SpaceShip,
    TreeLights,
} from "@/Models"
import { ProjectOutpost } from "@/Models/ProjectOutpost"
import { CollisionSensor } from "@/Models/SpaceShip/model/CollisionSensor"
import { GAME_CONTEXT } from "./DITypes"

const DIModels = GAME_CONTEXT.MODEL

console.log("DIModels Debug:", GAME_CONTEXT.MODEL) // 이 로그로 undefined 여부 확인

export const ModelModule = new ContainerModule((options) => {
    options
        .bind<TreeLights>(DIModels.TreeLights)
        .to(TreeLights)
        .inTransientScope()
    options.bind<SpaceShip>(DIModels.SpaceShip).to(SpaceShip).inTransientScope()
    options
        .bind<CollisionSensor>(DIModels.CollisionSensor)
        .to(CollisionSensor)
        .inTransientScope()
    options.bind<Floor>(DIModels.Floor).to(Floor).inTransientScope()
    options.bind<Mountain>(DIModels.Mountain).to(Mountain).inTransientScope()
    options
        .bind<MountainOutliner>(DIModels.MountainOutliner)
        .to(MountainOutliner)
        .inTransientScope()
    options.bind<Grass>(DIModels.Grass).to(Grass).inTransientScope()
    options
        .bind<FloatCrystal>(DIModels.FloatCrystal)
        .to(FloatCrystal)
        .inTransientScope()
    options
        .bind<BrightCrystal>(DIModels.BrightCrystal)
        .to(BrightCrystal)
        .inTransientScope()
    options
        .bind<CrystalStructure>(DIModels.CrystalStructure)
        .to(CrystalStructure)
        .inTransientScope()
    options.bind<Birds>(DIModels.Birds).to(Birds).inTransientScope()
    options.bind<Github>(DIModels.Github).to(Github).inTransientScope()
    options
        .bind<ProjectOutpost>(DIModels.ProjectOutpost)
        .to(ProjectOutpost)
        .inTransientScope()
})

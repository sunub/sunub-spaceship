import {
    ContainerModule,
    type Factory,
    type ResolutionContext,
} from "inversify"
import type { ProjectData } from "@/core/ProjectRegistry"
import type {
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
import type { GrassOptions } from "@/Models/Grass/Grass"
import type { ProjectOutpost } from "@/Models/ProjectOutpost"
import type { CollisionSensor } from "@/Models/SpaceShip/model/CollisionSensor"
import { GAME_CONTEXT } from "./DITypes"

export const FactoryModule = new ContainerModule(({ bind }) => {
    bind<Factory<SpaceShip>>(GAME_CONTEXT.FACTORY.SpaceShipFactory).toFactory(
        (context: ResolutionContext) => {
            return () => {
                return context.get<SpaceShip>(GAME_CONTEXT.MODEL.SpaceShip)
            }
        },
    )

    bind<Factory<CollisionSensor>>(
        GAME_CONTEXT.FACTORY.CollisionSensorFactory,
    ).toFactory((context: ResolutionContext) => {
        return () => {
            return context.get<CollisionSensor>(
                GAME_CONTEXT.MODEL.CollisionSensor,
            )
        }
    })

    bind<Factory<TreeLights, []>>(GAME_CONTEXT.FACTORY.TreeLights).toFactory(
        (context: ResolutionContext) => {
            return () => {
                return context.get<TreeLights>(GAME_CONTEXT.MODEL.TreeLights)
            }
        },
    )

    bind<Factory<Floor>>(GAME_CONTEXT.FACTORY.FloorFactory).toFactory(
        (context: ResolutionContext) => {
            return () => {
                return context.get<Floor>(GAME_CONTEXT.MODEL.Floor)
            }
        },
    )

    bind<Factory<Mountain>>(GAME_CONTEXT.FACTORY.MountainFactory).toFactory(
        (context: ResolutionContext) => {
            return () => {
                return context.get<Mountain>(GAME_CONTEXT.MODEL.Mountain)
            }
        },
    )

    bind<Factory<MountainOutliner>>(
        GAME_CONTEXT.FACTORY.MountainOutlinerFactory,
    ).toFactory((context: ResolutionContext) => {
        return () => {
            return context.get<MountainOutliner>(
                GAME_CONTEXT.MODEL.MountainOutliner,
            )
        }
    })

    bind<Factory<Grass>>(GAME_CONTEXT.FACTORY.GrassFactory).toFactory(
        (context: ResolutionContext) => {
            return (options: GrassOptions) => {
                const grass = context.get<Grass>(GAME_CONTEXT.MODEL.Grass)
                grass.updateParams(options)
                return grass
            }
        },
    )

    bind<Factory<FloatCrystal>>(
        GAME_CONTEXT.FACTORY.FloatCrystalFactory,
    ).toFactory((context: ResolutionContext) => {
        return () => {
            return context.get<FloatCrystal>(GAME_CONTEXT.MODEL.FloatCrystal)
        }
    })

    bind<Factory<BrightCrystal>>(
        GAME_CONTEXT.FACTORY.BrightCrystalFactory,
    ).toFactory((context: ResolutionContext) => {
        return () => {
            return context.get<BrightCrystal>(GAME_CONTEXT.MODEL.BrightCrystal)
        }
    })

    bind<Factory<CrystalStructure>>(
        GAME_CONTEXT.FACTORY.CrystalStructureFactory,
    ).toFactory((context: ResolutionContext) => {
        return () => {
            return context.get<CrystalStructure>(
                GAME_CONTEXT.MODEL.CrystalStructure,
            )
        }
    })

    bind<Factory<Birds>>(GAME_CONTEXT.FACTORY.BirdsFactory).toFactory(
        (context: ResolutionContext) => {
            return () => {
                return context.get<Birds>(GAME_CONTEXT.MODEL.Birds)
            }
        },
    )

    bind<Factory<Github>>(GAME_CONTEXT.FACTORY.GithubFactory).toFactory(
        (context: ResolutionContext) => {
            return () => {
                return context.get<Github>(GAME_CONTEXT.MODEL.Github)
            }
        },
    )

    bind<Factory<ProjectOutpost, [ProjectData]>>(
        GAME_CONTEXT.FACTORY.ProjectOutpostFactory,
    ).toFactory((context: ResolutionContext) => {
        return (data: ProjectData) => {
            const outpost = context.get<ProjectOutpost>(
                GAME_CONTEXT.MODEL.ProjectOutpost,
            )
            outpost.setup(data)
            return outpost
        }
    })
})

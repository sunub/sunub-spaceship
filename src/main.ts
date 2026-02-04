import "reflect-metadata";
import { DIContainer } from "./core/DI/inversify.config";
import { GAME_CONTEXT } from "./core/DI/DITypes";
import { GameBootstrapper } from "./core/GameBootstrapper";

const main = async () => {
    const gameBootstrapper = DIContainer.get<GameBootstrapper>(GAME_CONTEXT.GameBootstrapper)
    await gameBootstrapper.run()
}

main().catch(console.error)

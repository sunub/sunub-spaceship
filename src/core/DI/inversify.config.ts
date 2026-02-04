import { Container, type Factory } from "inversify";
import { GAME_CONTEXT } from "./DITypes";
import Time from "@/utils/Time";
import { Size } from "@/utils/Size";
import { InputManager } from "@/Inputs/InputManager";
import Resources from "@/utils/Resources";
import { Lighting } from "@/widgets/Lighting";
import { Game } from "@/widgets/Game";
import { Scene } from "@/widgets/Scene";
import { Camera } from "@/widgets/Camera";
import { Physics } from "@/widgets/Physics";
import { Rendering } from "@/widgets/Rendering";
import { Audio } from "@/widgets/Audio";
import { JoyStick } from "@/widgets/controllers/JoyStick";
import { SpaceShip } from "@/widgets/Models/SpaceShip/model/SpaceShip";
import { DOMManager } from "../DOMManger";
import { CSSRenderer } from "@/widgets/CSSRenderer";
import { Entry } from "@/core/Entry/Entry";
import { GameBootstrapper } from "../GameBootstrapper"; 

const DIContainer = new Container();

DIContainer.bind<GameBootstrapper>(GAME_CONTEXT.GameBootstrapper).to(GameBootstrapper).inSingletonScope();

DIContainer.bind<DOMManager>(GAME_CONTEXT.DOMManager).to(DOMManager).inSingletonScope();
DIContainer.bind<CSSRenderer>(GAME_CONTEXT.CSSRenderer).to(CSSRenderer).inSingletonScope();
DIContainer.bind<Time>(GAME_CONTEXT.Time).to(Time).inSingletonScope();
DIContainer.bind<Size>(GAME_CONTEXT.Size).to(Size).inSingletonScope();
DIContainer.bind<InputManager>(GAME_CONTEXT.InputManager).to(InputManager).inSingletonScope();
DIContainer.bind<Resources>(GAME_CONTEXT.Resources).to(Resources).inSingletonScope();
DIContainer.bind<Lighting>(GAME_CONTEXT.Lighting).to(Lighting).inSingletonScope();
DIContainer.bind<Game>(GAME_CONTEXT.Game).to(Game).inSingletonScope();
DIContainer.bind<Scene>(GAME_CONTEXT.Scene).to(Scene).inSingletonScope();
DIContainer.bind<Camera>(GAME_CONTEXT.Camera).to(Camera).inSingletonScope();
DIContainer.bind<Physics>(GAME_CONTEXT.Physics).to(Physics).inSingletonScope();
DIContainer.bind<Rendering>(GAME_CONTEXT.Rendering).to(Rendering).inSingletonScope();
DIContainer.bind<Audio>(GAME_CONTEXT.Audio).to(Audio).inSingletonScope();
DIContainer.bind<Entry>(GAME_CONTEXT.Entry).to(Entry).inSingletonScope();
DIContainer.bind<JoyStick>(GAME_CONTEXT.JoyStick).to(JoyStick).inTransientScope();
DIContainer.bind<SpaceShip>(GAME_CONTEXT.SpaceShip).to(SpaceShip).inTransientScope();
DIContainer.bind<Factory<SpaceShip>>(GAME_CONTEXT.SpaceShipFactory).toFactory(() => {
    return () => {
        return DIContainer.get<SpaceShip>(GAME_CONTEXT.SpaceShip);
    };
});

export { DIContainer }
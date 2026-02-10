import { ContainerModule } from "inversify";
import { GAME_CONTEXT } from "./DITypes";
import { JoyStick } from "@/Controllers/JoyStick";
import { SpaceShipCameraController } from "@/Controllers/SpaceShipCameraController";
import { SpaceShipAudioController } from "@/Controllers/SpaceShipAudioController";
import { SpaceShipInputHandler } from "@/Controllers/SpaceShipInputHandler";
import { SpaceShipAnimator } from "@/Controllers/SpaceShipAnimator";
import { SpaceShipDebugger } from "@/Controllers/SpaceShipDebugger";

export const ControllerModule = new ContainerModule((options) => {
  options.bind<JoyStick>(GAME_CONTEXT.CONTROLLER.JoyStick).to(JoyStick).inTransientScope();
  options.bind<SpaceShipCameraController>(GAME_CONTEXT.CONTROLLER.SpaceShipCameraController).to(SpaceShipCameraController).inSingletonScope();
  options.bind<SpaceShipAudioController>(GAME_CONTEXT.CONTROLLER.SpaceShipAudioController).to(SpaceShipAudioController).inTransientScope();
  options.bind<SpaceShipInputHandler>(GAME_CONTEXT.CONTROLLER.SpaceShipInputHandler).to(SpaceShipInputHandler).inTransientScope();
  options.bind<SpaceShipAnimator>(GAME_CONTEXT.CONTROLLER.SpaceShipAnimator).to(SpaceShipAnimator).inTransientScope();
  options.bind<SpaceShipDebugger>(GAME_CONTEXT.CONTROLLER.SpaceShipDebugger).to(SpaceShipDebugger).inTransientScope();
});

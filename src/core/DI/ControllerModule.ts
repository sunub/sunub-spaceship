import { ContainerModule } from "inversify";
import { GAME_CONTEXT } from "./DITypes";
import { JoyStick } from "@/controllers/JoyStick";
import { SpaceShipCameraController } from "@/controllers/SpaceShipCameraController";
import { SpaceShipAudioController } from "@/controllers/SpaceShipAudioController";
import { SpaceShipInputHandler } from "@/controllers/SpaceShipInputHandler";
import { SpaceShipAnimator } from "@/controllers/SpaceShipAnimator";
import { SpaceShipDebugger } from "@/controllers/SpaceShipDebugger";

export const ControllerModule = new ContainerModule((options) => {
  options.bind<JoyStick>(GAME_CONTEXT.CONTROLLER.JoyStick).to(JoyStick).inTransientScope();
  options.bind<SpaceShipCameraController>(GAME_CONTEXT.CONTROLLER.SpaceShipCameraController).to(SpaceShipCameraController).inSingletonScope();
  options.bind<SpaceShipAudioController>(GAME_CONTEXT.CONTROLLER.SpaceShipAudioController).to(SpaceShipAudioController).inTransientScope();
  options.bind<SpaceShipInputHandler>(GAME_CONTEXT.CONTROLLER.SpaceShipInputHandler).to(SpaceShipInputHandler).inTransientScope();
  options.bind<SpaceShipAnimator>(GAME_CONTEXT.CONTROLLER.SpaceShipAnimator).to(SpaceShipAnimator).inTransientScope();
  options.bind<SpaceShipDebugger>(GAME_CONTEXT.CONTROLLER.SpaceShipDebugger).to(SpaceShipDebugger).inTransientScope();
});
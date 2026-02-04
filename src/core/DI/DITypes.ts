export const GAME_CONTEXT = {
  // 유틸리티
  Time: Symbol.for("Time"),
  Size: Symbol.for("Size"),
  InputManager: Symbol.for("InputManager"),
  Resources: Symbol.for("Resources"),
  Lighting: Symbol.for("Lighting"),

  // 코어
  Game: Symbol.for("Game"),
  Scene: Symbol.for("Scene"),
  Camera: Symbol.for("Camera"),
  Physics: Symbol.for("Physics"),
  Rendering: Symbol.for("Rendering"),
  Audio: Symbol.for("Audio"),
  DOMManager: Symbol.for("DOMManager"),
  CSSRenderer: Symbol.for("CSSRenderer"),
  Entry: Symbol.for("Entry"),
  GameBootstrapper: Symbol.for("GameBootstrapper"),
  JoyStick: Symbol.for("JoyStick"),
  SpaceShip: Symbol.for("SpaceShip"),
  SpaceShipFactory: Symbol.for("SpaceShipFactory"),

  // 외부 라이브러리
  Rapier: Symbol.for("Rapier"),
}
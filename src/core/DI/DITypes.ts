const MODEL = {
    TreeLights: Symbol.for("TreeLights"),
    SpaceShip: Symbol.for("SpaceShip"),
    CollisionSensor: Symbol.for("CollisionSensor"),
    Floor: Symbol.for("Floor"),
    Mountain: Symbol.for("Mountain"),
    MountainOutliner: Symbol.for("MountainOutliner"),
    Grass: Symbol.for("Grass"),
    FloatCrystal: Symbol.for("FloatCrystal"),
    BrightCrystal: Symbol.for("BrightCrystal"),
    CrystalStructure: Symbol.for("CrystalStructure"),
    Birds: Symbol.for("Birds"),
    Github: Symbol.for("Github"),
    ProjectOutpost: Symbol.for("ProjectOutpost"),
};

const FACTORY = {
    TreeLights: Symbol.for("TreeLightsFactory"),
    SpaceShipFactory: Symbol.for("SpaceShipFactory"),
    CollisionSensorFactory: Symbol.for("CollisionSensorFactory"),
    FloorFactory: Symbol.for("FloorFactory"),
    MountainFactory: Symbol.for("MountainFactory"),
    MountainOutlinerFactory: Symbol.for("MountainOutlinerFactory"),
    GrassFactory: Symbol.for("GrassFactory"),
    FloatCrystalFactory: Symbol.for("FloatCrystalFactory"),
    BrightCrystalFactory: Symbol.for("BrightCrystalFactory"),
    CrystalStructureFactory: Symbol.for("CrystalStructureFactory"),
    BirdsFactory: Symbol.for("BirdsFactory"),
    GithubFactory: Symbol.for("GithubFactory"),
    ProjectOutpostFactory: Symbol.for("ProjectOutpostFactory"),
    FogFactory: Symbol.for("FogFactory"),
};

const CONTROLLER = {
    JoyStick: Symbol.for("JoyStick"),
    SpaceShipCameraController: Symbol.for("SpaceShipCameraController"),
    SpaceShipAudioController: Symbol.for("SpaceShipAudioController"),
    SpaceShipInputHandler: Symbol.for("SpaceShipInputHandler"),
    SpaceShipAnimator: Symbol.for("SpaceShipAnimator"),
    SpaceShipDebugger: Symbol.for("SpaceShipDebugger"),
};

const MANAGER = {
    WorldManager: Symbol.for("WorldManager"),
    InputManager: Symbol.for("InputManager"),
    DOMManager: Symbol.for("DOMManager"),
    SceneManager: Symbol.for("SceneManager"),
    ProjectManager: Symbol.for("ProjectManager"),
    EnvironmentManager: Symbol.for("EnvironmentManager"),
};

const SERVICE = {
    TerrainVisibilityArea: Symbol.for("TerrainVisibilityArea"),
    PhysicsService: Symbol.for("PhysicsService"),
    CollisionSensor: Symbol.for("CollisionSensor"),
    RaycasterService: Symbol.for("RaycasterService"),
    ResourceService: Symbol.for("ResourceService"),
};

const UI = {
    TerminalOverlay: Symbol.for("TerminalOverlay"),
    Notification: Symbol.for("Notification"),
    InputIndicator: Symbol.for("InputIndicator"),
};

const CORE = {
    Game: Symbol.for("Game"),
    Scene: Symbol.for("Scene"),
    Camera: Symbol.for("Camera"),
    Physics: Symbol.for("Physics"),
    Rendering: Symbol.for("Rendering"),
    Audio: Symbol.for("Audio"),
    CSSRenderer: Symbol.for("CSSRenderer"),
    Entry: Symbol.for("Entry"),
    GameBootstrapper: Symbol.for("GameBootstrapper"),
    SpaceShip: Symbol.for("SpaceShip"),
    Lighting: Symbol.for("Lighting"),
    EventBus: Symbol.for("EventBus"),
    GameLoop: Symbol.for("GameLoop"),
};

const EXTERNAL = {
    Rapier: Symbol.for("Rapier"),
};

const UTILITY = {
    Time: Symbol.for("Time"),
    Size: Symbol.for("Size"),
    Resources: Symbol.for("Resources"),
};

export const GAME_CONTEXT = {
    MODEL,
    FACTORY,
    CONTROLLER,
    MANAGER,
    SERVICE,
    CORE,
    EXTERNAL,
    UTILITY,
    UI,
};

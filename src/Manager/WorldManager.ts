import { inject, injectable } from "inversify"
import { Euler, type Mesh, type Object3D, Vector3 } from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import {
    type BrightCrystal,
    type CrystalStructure,
    type FloatCrystal,
    Floor,
    type Github,
    type Grass,
    ImagePlane,
    type Mountain,
    type MountainOutliner,
    ResourceModel,
    Text,
    type TreeLights,
} from "@/Models"
import type { GrassOptions } from "@/Models/Grass/Grass"
import type { IGameObject } from "@/Services/IGameObject"
import type { IResourceService } from "@/Services/IResouceService"
import type { ISceneManager } from "@/Services/ISceneManager"

@injectable()
export class WorldManager {
    private worldObjects: (Mesh | IGameObject | Object3D)[] = []
    public terrain!: Floor
    private isTerrainInitialized = false

    constructor(
        @inject(GAME_CONTEXT.FACTORY.TreeLights)
        treeLightsFactory: () => TreeLights,
        @inject(GAME_CONTEXT.FACTORY.FloorFactory) floorFactory: () => Floor,
        @inject(GAME_CONTEXT.FACTORY.MountainFactory)
        mountainFactory: () => Mountain,
        @inject(GAME_CONTEXT.FACTORY.MountainOutlinerFactory)
        mountainOutlinerFactory: () => MountainOutliner,
        @inject(GAME_CONTEXT.FACTORY.GrassFactory) grassFactory: (
            options: GrassOptions,
        ) => Grass,
        @inject(GAME_CONTEXT.FACTORY.FloatCrystalFactory)
        floatCrystalFactory: () => FloatCrystal,
        @inject(GAME_CONTEXT.FACTORY.BrightCrystalFactory)
        brightCrystalFactory: () => BrightCrystal,
        @inject(GAME_CONTEXT.FACTORY.CrystalStructureFactory)
        crystalStructureFactory: () => CrystalStructure,
        @inject(GAME_CONTEXT.FACTORY.GithubFactory) githubFactory: () => Github,
        @inject(GAME_CONTEXT.MANAGER.SceneManager)
        sceneManager: ISceneManager,
        @inject(GAME_CONTEXT.SERVICE.ResourceService)
        resourcesManager: IResourceService,
    ) {
        this.worldObjects = [
            floorFactory(),
            mountainFactory(),
            mountainOutlinerFactory(),
            grassFactory({
                count: 45000,
                width: 0.15,
                height: 1.0,
            }),
            treeLightsFactory(),
            floatCrystalFactory(),
            brightCrystalFactory(),
            crystalStructureFactory(),
            githubFactory(),
            new ImagePlane(sceneManager, resourcesManager, {
                textureName: "wasdIconTexture",
                name: "FloorWasdIcon",
                position: new Vector3(-2.65, 0.08, -4.5),
                rotation: new Euler(-Math.PI / 2, 0, 0),
                width: 3.35,
                renderOrder: 980,
                depthWrite: false,
                depthTest: true,
            }),
            new ImagePlane(sceneManager, resourcesManager, {
                textureName: "mobileTouchMoveIconTexture",
                name: "FloorWasdIcon",
                position: new Vector3(2.65, 0.08, -4.5),
                rotation: new Euler(-Math.PI / 2, 0, 0),
                width: 3.15,
                renderOrder: 980,
                depthWrite: false,
                depthTest: true,
            }),
            new Text(sceneManager, {
                text: "controls",
                name: "FloorKeyboardPrompt",
                position: new Vector3(-0.25, 0.08, -6.75),
                rotation: new Euler(-Math.PI / 2, 0, 0),
                fontOptions: {
                    size: 1,
                    strokeWidth: 0.15,
                    strokeColor: "#fefaf804",
                },
            }),
            new Text(sceneManager, {
                text: "or",
                name: "FloorKeyboardPrompt",
                position: new Vector3(0.15, 0.08, -3.75),
                rotation: new Euler(-Math.PI / 2, 0, 0),
                fontOptions: {
                    size: 1,
                    strokeWidth: 0.15,
                    strokeColor: "#fefaf804",
                },
            }),
        ]
    }

    public async prepareTerrain(): Promise<Floor> {
        if (!this.terrain) {
            const terrainObject = this.worldObjects.find(
                (obj) => obj instanceof Floor,
            )
            if (!terrainObject) {
                throw new Error("WorldManager: Floor object not found.")
            }

            this.terrain = terrainObject
        }

        if (!this.isTerrainInitialized) {
            await this.terrain.initialize(false)
            this.isTerrainInitialized = true
        }

        return this.terrain
    }

    public async prepareGameObjects(options?: {
        skipTerrainInitialization?: boolean
        addToScene?: boolean
        visible?: boolean
    }) {
        const {
            skipTerrainInitialization = false,
            addToScene = true,
            visible = true,
        } = options ?? {}

        const sceneObjectsPromises = this.worldObjects.map(async (obj) => {
            if (obj instanceof Floor) {
                this.terrain = obj

                if (skipTerrainInitialization && this.isTerrainInitialized) {
                    obj.setVisible(visible)
                    if (addToScene) {
                        obj.attachToScene()
                    }
                    return
                }
                await obj.initialize(addToScene)
                obj.setVisible(visible)
                this.isTerrainInitialized = true
            } else if (obj instanceof ResourceModel) {
                await obj.initialize(addToScene)
                obj.setVisible(visible)
            } else if (
                "initialize" in obj &&
                typeof obj.initialize === "function"
            ) {
                await obj.initialize(addToScene)
                if (
                    "setVisible" in obj &&
                    typeof obj.setVisible === "function"
                ) {
                    obj.setVisible(visible)
                }
            }
        })

        await Promise.all(sceneObjectsPromises)
    }

    public attachPreparedObjects() {
        this.worldObjects.forEach((obj) => {
            if (
                "attachToScene" in obj &&
                typeof obj.attachToScene === "function"
            ) {
                obj.attachToScene()
            }
        })
    }

    public setWorldVisibility(visible: boolean) {
        this.worldObjects.forEach((obj) => {
            if ("setVisible" in obj && typeof obj.setVisible === "function") {
                obj.setVisible(visible)
            } else if ("visible" in obj) {
                ; (obj as Object3D).visible = visible
            }
        })
    }

    public addGameObject(gameObject: IGameObject | Mesh | Object3D) {
        this.worldObjects.push(gameObject)
    }

    public updatePhysics(deltaTime: number) {
        this.worldObjects.forEach((obj) => {
            if (
                "updatePhysics" in obj &&
                typeof (obj as IGameObject).updatePhysics === "function"
            ) {
                ; (obj as IGameObject).updatePhysics?.(deltaTime)
            }
        })
    }

    public update(deltaTime: number) {
        this.worldObjects.forEach((obj) => {
            if (
                "update" in obj &&
                typeof (obj as IGameObject).update === "function"
            ) {
                ; (obj as IGameObject).update(deltaTime)
            }
        })
    }

    public syncVisibilityCulling() {
        this.worldObjects.forEach((obj) => {
            const visibilityTarget = obj as {
                syncVisibilityCulling?: () => void
            }

            if (typeof visibilityTarget.syncVisibilityCulling === "function") {
                visibilityTarget.syncVisibilityCulling()
            }
        })
    }

    get gameObjects() {
        return this.worldObjects
    }
}

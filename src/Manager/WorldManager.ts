import { GAME_CONTEXT } from "@/core/DI/DITypes";
import { inject, injectable } from "inversify"
import type { Mesh, Object3D } from "three/webgpu";
import { Floor, Mountain, MountainOutliner, Grass, TreeLights, FloatCrystal, BrightCrystal, CrystalStructure, Birds, Github, ResourceModel } from "@/Models"
import type { IGameObject } from "@/Services/IGameObject";
import type { GrassOptions } from "@/Models/Grass/Grass";

@injectable()
export class WorldManager {
  private worldObjects: (Mesh | IGameObject | Object3D)[] = [];
  public terrain!: Floor;
  private isTerrainInitialized = false

  constructor(
    @inject(GAME_CONTEXT.FACTORY.TreeLights) treeLightsFactory: () => TreeLights,
    @inject(GAME_CONTEXT.FACTORY.FloorFactory) floorFactory: () => Floor,
    @inject(GAME_CONTEXT.FACTORY.MountainFactory) mountainFactory: () => Mountain,
    @inject(GAME_CONTEXT.FACTORY.MountainOutlinerFactory) mountainOutlinerFactory: () => MountainOutliner,
    @inject(GAME_CONTEXT.FACTORY.GrassFactory) grassFactory: (options: GrassOptions) => Grass,
    @inject(GAME_CONTEXT.FACTORY.FloatCrystalFactory) floatCrystalFactory: () => FloatCrystal,
    @inject(GAME_CONTEXT.FACTORY.BrightCrystalFactory) brightCrystalFactory: () => BrightCrystal,
    @inject(GAME_CONTEXT.FACTORY.CrystalStructureFactory) crystalStructureFactory: () => CrystalStructure,
    @inject(GAME_CONTEXT.FACTORY.BirdsFactory) birdsFactory: () => Birds,
    @inject(GAME_CONTEXT.FACTORY.GithubFactory) githubFactory: () => Github,
  ) {
    this.worldObjects = [
      floorFactory(),
      mountainFactory(),
      mountainOutlinerFactory(),
      grassFactory({
        count: 25000,
        width: 0.15,
        height: 1.0,
      }),
      treeLightsFactory(),
      floatCrystalFactory(),
      brightCrystalFactory(),
      crystalStructureFactory(),
      birdsFactory(),
      githubFactory(),
    ];
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
      await this.terrain.initialize()
      this.isTerrainInitialized = true
    }

    return this.terrain
  }

  public async prepareGameObjects(options?: {
    skipTerrainInitialization?: boolean
  }) {
    const { skipTerrainInitialization = false } = options ?? {}

    const sceneObjectsPromises = this.worldObjects.map(async (obj) => {
      if (obj instanceof Floor) {
        this.terrain = obj

        if (skipTerrainInitialization && this.isTerrainInitialized) {
          return
        }
        await obj.initialize()
        this.isTerrainInitialized = true
      } else if (obj instanceof ResourceModel) {
        await obj.initialize()
      }
    });

    await Promise.all(sceneObjectsPromises);
  }

  public addGameObject(gameObject: (IGameObject | Mesh | Object3D)) {
    this.worldObjects.push(gameObject);
  }

  public updatePhysics(deltaTime: number) {
    this.worldObjects.forEach((obj) => {
      if ('updatePhysics' in obj && typeof (obj as IGameObject).updatePhysics === 'function') {
        (obj as IGameObject).updatePhysics!(deltaTime);
      }
    });
  }

  public update(deltaTime: number) {
    this.worldObjects.forEach((obj) => {
      if ('update' in obj && typeof (obj as IGameObject).update === 'function') {
        (obj as IGameObject).update(deltaTime);
      }
    });
  }

  get gameObjects() {
    return this.worldObjects;
  }
}

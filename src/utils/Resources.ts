import { EXRLoader } from "three/examples/jsm/Addons.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"
import {
    CubeTextureLoader,
    TextureLoader,
    type WebGPURenderer,
} from "three/webgpu"
import { HDRLoader } from "./HDRLoader.js"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes.js"
import type { Rendering } from "@/core/Rendering.js"
import type { IResourceService } from "@/Services/IResouceService.js"

export type LoaderType =
    | "gltfModel"
    | "texture"
    | "cubeTexture"
    | "textureKtx"
    | "draco"
    | "hdr"
    | "exr"
    | "jpg"
    | "png"
    | "ktx2"
    | "font"

export type Source = [string, LoaderType, string, ((resource: any) => void)?]

@injectable()
export class Resources implements IResourceService {
    private loaders = new Map<string, any>()
    public items: Record<string, any> = {}
    private static ktx2Loader: KTX2Loader | null = null

    constructor(
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
    ) {}

    public getItem<T = any>(name: string): T {
        const item = this.items[name];
        if (!item) {
            throw new Error(`Resource '${name}' not found.`);
        }
        return item as T;
    }

    public async load(
        sources: Source[],
        onProgress?: (loaded: number, total: number) => void,
    ): Promise<Record<string, any>> {
        const loadedResources: Record<string, any> = {}
        const toLoad = sources.length
        let loadedCount = 0

        const getRenderer = () => {
            try {
                return this.rendering.renderer
            } catch (_) {
                console.warn(
                    "Resources: Renderer not found in registry, KTX2Loader might fail if not initialized.",
                )
                return undefined
            }
        }

        const sourcesPromise = sources.map(async (source) => {
            const [name, type, path, callback] = source

            if (this.items[name]) {
                loadedResources[name] = this.items[name]
                loadedCount++
                onProgress?.(loadedCount, toLoad)
                return
            }

            const loader = this.getLoader(type, getRenderer())

            if (!loader) {
                console.warn(`Resources: No loader found for type ${type}`)
                loadedCount++
                onProgress?.(loadedCount, toLoad)
                return
            }

            try {
                const file = await new Promise((resolve, reject) => {
                    if (type === "cubeTexture") {
                        loader.load([path], resolve, undefined, reject)
                    } else {
                        loader.load(path, resolve, undefined, reject)
                    }
                })

                if (callback) callback(file)
                loadedResources[name] = file
                this.items[name] = file
            } catch (error) {
                console.error(
                    `Resources: Failed to load ${name} at ${path}`,
                    error,
                )
            } finally {
                loadedCount++
                onProgress?.(loadedCount, toLoad)
            }
        })
        await Promise.all(sourcesPromise)
        return loadedResources
    }

    private getSharedKTX2Loader(renderer?: WebGPURenderer) {
        if (!Resources.ktx2Loader) {
            Resources.ktx2Loader = new KTX2Loader()
            Resources.ktx2Loader.setTranscoderPath("/basis/")
            if (renderer) {
                Resources.ktx2Loader.detectSupport(renderer)
            }
        }
        return Resources.ktx2Loader
    }

    private getLoader(type: LoaderType, renderer?: WebGPURenderer) {
        if (this.loaders.has(type)) return this.loaders.get(type)

        let loader: any

        switch (type) {
            case "gltfModel": {
                const gltfLoader = new GLTFLoader()
                const dracoLoader = new DRACOLoader()
                dracoLoader.setDecoderPath("/draco/")
                gltfLoader.setDRACOLoader(dracoLoader)

                const ktx2Loader = this.getSharedKTX2Loader(renderer)
                gltfLoader.setKTX2Loader(ktx2Loader)

                loader = gltfLoader
                break
            }

            case "jpg":
                loader = new TextureLoader()
                break

            case "png":
                loader = new TextureLoader()
                break

            case "draco":
                loader = new DRACOLoader()
                loader.setDecoderPath("/draco/")
                break

            case "texture":
                loader = new TextureLoader()
                break

            case "exr":
                loader = new EXRLoader()
                break

            case "ktx2":
                loader = this.getSharedKTX2Loader(renderer)
                break

            case "cubeTexture":
                loader = new CubeTextureLoader()
                break

            case "hdr":
                loader = new HDRLoader()
                break
        }

        if (loader) {
            this.loaders.set(type, loader)
        }

        return loader
    }
}

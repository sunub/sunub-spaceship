import { inject, injectable } from "inversify"
import { EXRLoader } from "three/examples/jsm/Addons.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"
import {
    CubeTextureLoader,
    TextureLoader,
    type WebGPURenderer,
} from "three/webgpu"
import { GAME_CONTEXT } from "@/core/DI/DITypes.js"
import type { Rendering } from "@/core/Rendering.js"
import type { IResourceService } from "@/Services/IResouceService.js"
import { HDRLoader } from "./HDRLoader.js"
import { PerformanceTracker } from "./PerformanceTracker.js"

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

export type LoadProgressInfo = {
    name: string
    type: LoaderType
    path: string
    index: number
    total: number
}

export type LoadProgressCallback = (
    loaded: number,
    total: number,
    info: LoadProgressInfo,
) => void

type ResourceYieldMode = "microtask" | "animationFrame"

type LoadOptions = {
    concurrency?: number
    resourcePhase?: string
    resourcePriority?: (source: Source, index: number) => number
    yieldAfter?: number
    yieldMode?: ResourceYieldMode
}

@injectable()
export class Resources implements IResourceService {
    private loaders = new Map<string, any>()
    public items: Record<string, any> = {}
    private static ktx2Loader: KTX2Loader | null = null

    constructor(
        @inject(GAME_CONTEXT.CORE.Rendering) private rendering: Rendering,
    ) {}

    public getItem<T = any>(name: string): T {
        const item = this.items[name]
        if (!item) {
            throw new Error(`Resource '${name}' not found.`)
        }
        return item as T
    }

    public async load(
        sources: Source[],
        onProgress?: LoadProgressCallback,
        options: LoadOptions = {},
    ): Promise<Record<string, any>> {
        const loadedResources: Record<string, any> = {}
        const toLoad = sources.length
        if (toLoad === 0) {
            return loadedResources
        }

        const sourcePriority = options.resourcePriority

        let loadedCount = 0
        const maxConcurrency = this.resolveConcurrency(
            options.concurrency,
            toLoad,
        )
        const yieldAfter = Math.max(0, options.yieldAfter ?? 0)
        const yieldMode = options.yieldMode ?? "microtask"
        let processedSinceYield = 0

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

        const queue = sources
            .map((source, index) => ({
                source,
                index,
                priority: sourcePriority ? sourcePriority(source, index) : 0,
            }))
            .sort((a, b) => {
                if (a.priority === b.priority) {
                    return a.index - b.index
                }
                return a.priority - b.priority
            })
            .map((entry) => entry)
        let queueIndex = 0

        const loadSingle = async () => {
            while (queueIndex < queue.length) {
                const queuedSource = queue[queueIndex++]
                if (!queuedSource) {
                    continue
                }

                const { source, index } = queuedSource
                const [name, type, path, callback] = source

                if (this.items[name]) {
                    loadedResources[name] = this.items[name]
                    loadedCount++
                    onProgress?.(loadedCount, toLoad, {
                        name,
                        type,
                        path,
                        index,
                        total: toLoad,
                    })
                    continue
                }

                const loader = this.getLoader(type, getRenderer())

                if (!loader) {
                    console.warn(`Resources: No loader found for type ${type}`)
                    loadedCount++
                    onProgress?.(loadedCount, toLoad, {
                        name,
                        type,
                        path,
                        index,
                        total: toLoad,
                    })
                    continue
                }

                try {
                    const file = await PerformanceTracker.trackResource(
                        name,
                        type,
                        path,
                        () =>
                            new Promise((resolve, reject) => {
                                if (type === "cubeTexture") {
                                    loader.load(
                                        [path],
                                        resolve,
                                        undefined,
                                        reject,
                                    )
                                } else {
                                    loader.load(
                                        path,
                                        resolve,
                                        undefined,
                                        reject,
                                    )
                                }
                            }),
                        options.resourcePhase,
                    )

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
                    onProgress?.(loadedCount, toLoad, {
                        name,
                        type,
                        path,
                        index,
                        total: toLoad,
                    })
                }

                if (yieldAfter > 0 && ++processedSinceYield >= yieldAfter) {
                    processedSinceYield = 0
                    await this.yieldToBrowser(yieldMode)
                }
            }
        }

        await Promise.all(Array.from({ length: maxConcurrency }, loadSingle))
        return loadedResources
    }

    private yieldToBrowser(mode: ResourceYieldMode): Promise<void> {
        if (mode === "animationFrame") {
            return new Promise((resolve) =>
                requestAnimationFrame(() => resolve()),
            )
        }

        return Promise.resolve()
    }

    private resolveConcurrency(
        requestedConcurrency: number | undefined,
        sourceCount: number,
    ): number {
        const cpu =
            typeof navigator === "undefined"
                ? 4
                : navigator.hardwareConcurrency || 4
        const defaultConcurrency = Math.max(2, Math.min(cpu, 6))
        if (sourceCount <= 1) return 1
        return Math.max(
            1,
            Math.min(sourceCount, requestedConcurrency ?? defaultConcurrency),
        )
    }

    private getSharedKTX2Loader(renderer?: WebGPURenderer) {
        if (!Resources.ktx2Loader) {
            Resources.ktx2Loader = new KTX2Loader()
            Resources.ktx2Loader.setTranscoderPath("/basis/")
            const hardwareConcurrency =
                typeof navigator === "undefined"
                    ? 4
                    : navigator.hardwareConcurrency || 4
            const workerLimit = Math.max(
                1,
                Math.min(4, Math.ceil(hardwareConcurrency / 2)),
            )
            ;(Resources.ktx2Loader as KTX2Loader).setWorkerLimit?.(workerLimit)
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

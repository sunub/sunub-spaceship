import { EXRLoader } from "three/examples/jsm/Addons.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"
import * as THREE from "three/webgpu"
import { ServiceRegistry } from "@/core/ServiceRegistry"
import { HDRLoader } from "./HDRLoader.js"

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

export default class Resources {
    private loaders = new Map<string, any>()
    public items: Record<string, any> = {}
    private registry: ServiceRegistry
    private static ktx2Loader: KTX2Loader | null = null

    constructor() {
        this.registry = ServiceRegistry.getInstance()
    }

    public getItem(name: string) {
        return this.items[name]
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
                return this.registry.get<THREE.WebGPURenderer>("renderer")
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

    private getSharedKTX2Loader(renderer?: THREE.WebGPURenderer) {
        if (!Resources.ktx2Loader) {
            Resources.ktx2Loader = new KTX2Loader()
            Resources.ktx2Loader.setTranscoderPath("/basis/")
            if (renderer) {
                Resources.ktx2Loader.detectSupport(renderer)
            }
        }
        return Resources.ktx2Loader
    }

    private getLoader(type: LoaderType, renderer?: THREE.WebGPURenderer) {
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
                loader = new THREE.TextureLoader()
                break

            case "png":
                loader = new THREE.TextureLoader()
                break

            case "draco":
                loader = new DRACOLoader()
                loader.setDecoderPath("/draco/")
                break

            case "texture":
                loader = new THREE.TextureLoader()
                break

            case "exr":
                loader = new EXRLoader()
                break

            case "ktx2":
                loader = this.getSharedKTX2Loader(renderer)
                break

            case "cubeTexture":
                loader = new THREE.CubeTextureLoader()
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

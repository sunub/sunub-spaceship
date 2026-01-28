import type { Texture } from "three/webgpu"
import { ClampToEdgeWrapping, LinearFilter, SRGBColorSpace } from "three/webgpu"
import type { Source } from "./utils/Resources"

export const modelSources = [
    ["floorModel", "gltfModel", "/models/floor/floor-compressed.glb"],
    ["spaceshipModel", "gltfModel", "/models/player/spaceship-compressed.glb"],
    ["mountainModel", "gltfModel", "/models/floor/mountain-compressed.glb"],
    [
        "mountainOutlinerModel",
        "gltfModel",
        "/models/ground/mountain_outliner-compressed.glb",
    ],
    ["grassModel", "gltfModel", "/models/floor/grass-compressed.glb"],
    ["crystalModel", "gltfModel", "/models/ground/crystal-compressed.glb"],
    [
        "treeLightsModel",
        "gltfModel",
        "/models/ground/tree_lights-compressed.glb",
    ],
    ["crystalBase", "gltfModel", "/models/ground/crystal_base-compressed.glb"],
    [
        "floatCrystalModel",
        "gltfModel",
        "/models/ground/float_crystal-compressed.glb",
    ],
    [
        "brightCrystalModel",
        "gltfModel",
        "/models/ground/bright_crystal-compressed.glb",
    ],
    [
        "crystalStructure",
        "gltfModel",
        "/models/ground/crystal_structure-compressed.glb",
    ],
    ["githubModel", "gltfModel", "/models/ground/github-compressed.glb"],
] as Source[]

export const textureSources = [
    [
        "mountainTexture",
        "ktx2",
        "/texture/mountain/baked_mountain.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],

    [
        "floatCrystalTexture",
        "ktx2",
        "/texture/float_crystal/baked_float_crystal.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],
    [
        "crystalStructureTexture",
        "ktx2",
        "/texture/crystal_structure/crystal_structure.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],
    [
        "floorTexture",
        "ktx2",
        "/texture/floor/baked_floor.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],
    [
        "grassTexture",
        "ktx2",
        "/texture/floor/grass_bake.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],
    ["terrainGrassTexture", "ktx2", "/texture/terrainGrass/terrainGrass.ktx2"],
    ["treeLights", "gltfModel", "/models/ground/tree_lights-compressed.glb"],
] as Source[]

export const entrySources = [
    ["planet", "gltfModel", "/models/sky/planet_optimize-compressed.glb"],
    ["atmosphere", "gltfModel", "/models/sky/atmosphere-compressed.glb"],
    [
        "atmosphereLand",
        "gltfModel",
        "/models/sky/atmosphereLand-compressed.glb",
    ],
    [
        "atmosphereCrystalLights",
        "gltfModel",
        "/models/sky/atmosphere_crystal_lights-compressed.glb",
    ],
    [
        "atmosphereTreeLights",
        "gltfModel",
        "/models/sky/atmosphere_tree_lights-compressed.glb",
    ],
    [
        "entryTitle",
        "gltfModel",
        "/models/sky/spaceship_entry_title-compressed.glb",
    ],
    ["behindeTheScene", "ktx2", "/texture/behindTheScene/stars.ktx2"],
    [
        "treeLightsTexture",
        "ktx2",
        "/texture/tree_light/baked_tree_light.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],
    [
        "atmosphereTreeLightsTexture",
        "ktx2",
        "/texture/atmosphereTreeLight/baked_atmosphere_tree_lights.ktx2",
        (source: Texture) => {
            source.flipY = false
            source.colorSpace = SRGBColorSpace
            source.minFilter = LinearFilter
            source.magFilter = LinearFilter
            source.generateMipmaps = false
            source.wrapS = ClampToEdgeWrapping
            source.wrapT = ClampToEdgeWrapping
        },
    ],
] as Source[]

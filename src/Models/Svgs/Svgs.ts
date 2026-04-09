import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"
import { color, float } from "three/tsl"
import {
    Box3,
    Color,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    ShapeGeometry,
    Vector3,
    type Object3D,
    type Vector2,
} from "three/webgpu"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"

type SvgData = Awaited<ReturnType<SVGLoader["loadAsync"]>>
type SvgColorValue = string | number | Color
type SvgLoaderPath = {
    subPaths?: { getPoints: () => Vector2[] }[]
    userData?: {
        style?: SvgPathStyle
    }
}
type SvgPathStyle = {
    fill?: string
    fillOpacity?: number | string
    stroke?: string
    strokeOpacity?: number | string
}

export interface SvgBuildOptions {
    name?: string
    size?: number
    scale?: number
    center?: boolean
    flipY?: boolean
    drawFillShapes?: boolean
    drawStrokes?: boolean
    fillShapesWireframe?: boolean
    strokesWireframe?: boolean
    fillColor?: SvgColorValue
    strokeColor?: SvgColorValue
    defaultFillColor?: SvgColorValue
    defaultStrokeColor?: SvgColorValue
    fillOpacity?: number
    strokeOpacity?: number
    opacity?: number
    depthWrite?: boolean
    depthTest?: boolean
    layerOffset?: number
    renderOrder?: number
}

const DEFAULT_SVG_SIZE = 4
const DEFAULT_GLOBAL_OPACITY = 1
const DEFAULT_LAYER_OFFSET = 0.002
const DEFAULT_RENDER_ORDER = 100

const svgLoader = new SVGLoader()
const svgCache = new Map<string, Promise<SvgData>>()

const preload = async (svgUrl: string): Promise<SvgData> => {
    const cached = svgCache.get(svgUrl)
    if (cached) {
        return cached
    }

    const nextSvg = svgLoader.loadAsync(svgUrl)
    svgCache.set(svgUrl, nextSvg)
    return nextSvg
}

const build = async (
    svgUrl: string,
    options: SvgBuildOptions = {},
): Promise<Group> => {
    const rootGroup = new Group()
    rootGroup.name = options.name ?? getDefaultSvgName(svgUrl)
    rootGroup.userData.svgUrl = svgUrl

    const data = await preload(svgUrl)
    const contentGroup = new Group()
    const layerEntries: Mesh[] = []
    let renderOrder = 0

    for (const pathData of data.paths) {
        const path = pathData as unknown as SvgLoaderPath
        const style = path.userData?.style ?? {}

        if (options.drawFillShapes !== false) {
            const fillColor = resolvePaintColor(
                style.fill,
                options.fillColor,
                options.defaultFillColor,
            )
            const fillOpacity = resolveOpacity(
                style.fillOpacity,
                options.fillOpacity,
                options.opacity,
            )

            if (fillColor && fillOpacity > 0) {
                const fillMaterial = createSvgMaterial(
                    fillColor,
                    fillOpacity,
                    options.fillShapesWireframe ?? false,
                    options,
                )

                for (const shape of SVGLoader.createShapes(path as any)) {
                    const geometry = new ShapeGeometry(shape)
                    const mesh = new Mesh(geometry, fillMaterial)
                    mesh.castShadow = false
                    mesh.receiveShadow = false
                    mesh.renderOrder =
                        (options.renderOrder ?? DEFAULT_RENDER_ORDER) +
                        renderOrder++
                    mesh.frustumCulled = false
                    layerEntries.push(mesh)
                    contentGroup.add(mesh)
                }
            }
        }

        if (options.drawStrokes === false) {
            continue
        }

        const strokeColor = resolvePaintColor(
            style.stroke,
            options.strokeColor,
            options.defaultStrokeColor,
        )
        const strokeOpacity = resolveOpacity(
            style.strokeOpacity,
            options.strokeOpacity,
            options.opacity,
        )

        if (!strokeColor || strokeOpacity <= 0 || !path.subPaths?.length) {
            continue
        }

        const strokeMaterial = createSvgMaterial(
            strokeColor,
            strokeOpacity,
            options.strokesWireframe ?? false,
            options,
        )

        for (const subPath of path.subPaths) {
            const geometry = SVGLoader.pointsToStroke(
                subPath.getPoints(),
                style as any,
            )

            if (!geometry) {
                continue
            }

            const mesh = new Mesh(geometry, strokeMaterial)
            mesh.castShadow = false
            mesh.receiveShadow = false
            mesh.renderOrder =
                (options.renderOrder ?? DEFAULT_RENDER_ORDER) + renderOrder++
            mesh.frustumCulled = false
            layerEntries.push(mesh)
            contentGroup.add(mesh)
        }
    }

    rootGroup.add(contentGroup)

    if (contentGroup.children.length === 0) {
        return rootGroup
    }

    contentGroup.updateWorldMatrix(false, true)

    const bounds = new Box3().setFromObject(contentGroup)
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const maxDimension = Math.max(size.x, size.y, 1)
    const uniformScale =
        ((options.size ?? DEFAULT_SVG_SIZE) / maxDimension) *
        (options.scale ?? 1)

    if (options.center !== false) {
        contentGroup.position.x -= center.x
        contentGroup.position.y -= center.y
    }

    contentGroup.scale.set(
        uniformScale,
        (options.flipY ?? true) ? -uniformScale : uniformScale,
        uniformScale,
    )

    const localLayerOffset =
        (options.layerOffset ?? DEFAULT_LAYER_OFFSET) / uniformScale
    layerEntries.forEach((entry, index) => {
        entry.position.z = index * localLayerOffset
    })

    return rootGroup
}

const dispose = (object: Object3D): void => {
    object.traverse((child) => {
        if (!(child instanceof Mesh)) {
            return
        }

        child.geometry.dispose()

        const material = child.material
        if (Array.isArray(material)) {
            material.forEach((entry) => {
                entry.dispose()
            })
            return
        }

        material.dispose()
    })
}

function createSvgMaterial(
    materialColor: Color,
    opacity: number,
    wireframe: boolean,
    options: SvgBuildOptions,
): MeshDefaultMaterial | MeshBasicMaterial {
    const clampedOpacity = clamp01(opacity)
    const isTransparent = clampedOpacity < 1
    const depthWrite = options.depthWrite ?? false
    const depthTest = options.depthTest ?? true
    const transparentPass = isTransparent || !depthWrite

    try {
        return new MeshDefaultMaterial({
            colorNode: color(0x000000),
            emissionNode: color(materialColor).mul(2),
            alphaNode: float(clampedOpacity),
            transparent: transparentPass,
            depthWrite,
            depthTest,
            side: DoubleSide,
            shadowSide: DoubleSide,
            wireframe,
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
            hasFog: false,
            reorientDoubleSidedNormals: false,
        })
    } catch {
        return new MeshBasicMaterial({
            color: materialColor,
            transparent: transparentPass,
            opacity: clampedOpacity,
            depthWrite,
            depthTest,
            side: DoubleSide,
            wireframe,
        })
    }
}

function resolvePaintColor(
    styleColor: string | undefined,
    overrideColor: SvgColorValue | undefined,
    fallbackColor: SvgColorValue | undefined,
): Color | null {
    if (overrideColor !== undefined) {
        return toColor(overrideColor)
    }

    if (styleColor && styleColor !== "none") {
        try {
            return new Color().setStyle(styleColor)
        } catch {
            return fallbackColor !== undefined ? toColor(fallbackColor) : null
        }
    }

    return fallbackColor !== undefined ? toColor(fallbackColor) : null
}

function resolveOpacity(
    styleOpacity: number | string | undefined,
    overrideOpacity: number | undefined,
    globalOpacity: number | undefined,
): number {
    const baseOpacity =
        overrideOpacity ?? parseNumber(styleOpacity, DEFAULT_GLOBAL_OPACITY)

    return clamp01(baseOpacity * (globalOpacity ?? DEFAULT_GLOBAL_OPACITY))
}

function parseNumber(value: number | string | undefined, fallback: number) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value
    }

    if (typeof value === "string") {
        const parsed = Number.parseFloat(value)
        if (Number.isFinite(parsed)) {
            return parsed
        }
    }

    return fallback
}

function getDefaultSvgName(svgUrl: string): string {
    const fileName = svgUrl.split("/").pop()
    return fileName?.replace(/\.[^/.]+$/, "") || "SvgGraphic"
}

function toColor(colorValue: SvgColorValue): Color {
    if (colorValue instanceof Color) {
        return colorValue.clone()
    }

    return new Color(colorValue)
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value))
}

export const Svgs = {
    preload,
    build,
    dispose,
}

import { FileLoader } from "three"
import { strFromU8, unzipSync } from "three/addons/libs/fflate.module.js"
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"
import { color, float, texture } from "three/tsl"
import {
    CanvasTexture,
    Color,
    DoubleSide,
    Group,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    ShapeGeometry,
    SRGBColorSpace,
    type Box3,
    type Object3D,
} from "three/webgpu"
import { MeshDefaultMaterial } from "@/Materials/MeshDefaultMaterial"

type FontColorValue = string | number | Color
type FontDirection = "ltr" | "rtl" | "tb"
type FontLike = Font & {
    generateShapes: (
        text: string,
        size: number,
        direction: FontDirection,
    ) => any[]
}

export interface FontBuildOptions {
    fontUrl?: string
    fontFamily?: string
    fontWeight?: string | number
    fontStyle?: string
    name?: string
    size?: number
    direction?: FontDirection
    strokeWidth?: number
    fillColor?: FontColorValue
    strokeColor?: FontColorValue
    fillOpacity?: number
    fillOffsetZ?: number
    centerX?: boolean
    curveSegments?: number
    lineHeight?: number
    padding?: number
}

const DEFAULT_GEOMETRY_FONT_URL =
    "/fonts/MPLUSRounded1c-Regular.typeface.json.zip"
const DEFAULT_FONT_FAMILY = '"Pretendard", "Cinzel", sans-serif'
const DEFAULT_FONT_WEIGHT = 400
const DEFAULT_FONT_STYLE = "normal"
const DEFAULT_FILL_COLOR = "#006699"
const DEFAULT_STROKE_COLOR = "#006699"
const DEFAULT_FILL_OPACITY = 0.4
const DEFAULT_CSS_WORLD_SIZE = 4
const DEFAULT_CSS_LINE_HEIGHT = 1.2
const DEFAULT_CSS_RESOLUTION = 64
const CSS_PRELOAD_TEXT = "BESbswy가나다라마바사WASD"

const fontLoader = new FontLoader()
const fileLoader = new FileLoader()
const fontCache = new Map<string, Promise<Font>>()

const normalizeOptions = (
    fontUrlOrOptions: string | FontBuildOptions = {},
): FontBuildOptions => {
    if (typeof fontUrlOrOptions === "string") {
        return { fontUrl: fontUrlOrOptions }
    }

    return fontUrlOrOptions
}

const preload = async (
    fontUrlOrOptions: string | FontBuildOptions = {},
): Promise<Font | undefined> => {
    const options = normalizeOptions(fontUrlOrOptions)

    if (options.fontUrl) {
        return preloadGeometryFont(options.fontUrl)
    }

    await preloadCssFont(options)
}

const build = async (
    text: string,
    options: FontBuildOptions = {},
): Promise<Group> => {
    const group = new Group()
    group.name = options.name ?? "FontsText"
    group.userData.text = text

    if (!text) {
        return group
    }

    if (options.fontUrl) {
        return buildGeometryText(text, options)
    }

    await preloadCssFont(options)
    return buildCssText(text, options)
}

const dispose = (object: Object3D): void => {
    object.traverse((child) => {
        if (!(child instanceof Mesh)) {
            return
        }

        child.geometry.dispose()

        const textTexture = child.userData.textTexture
        if (textTexture instanceof CanvasTexture) {
            textTexture.dispose()
        }

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

async function preloadGeometryFont(fontUrl: string): Promise<Font> {
    const cachedFont = fontCache.get(fontUrl)
    if (cachedFont) {
        return cachedFont
    }

    const nextFont = loadGeometryFont(fontUrl)
    fontCache.set(fontUrl, nextFont)
    return nextFont
}

async function preloadCssFont(options: FontBuildOptions): Promise<void> {
    if (typeof document === "undefined" || !("fonts" in document)) {
        return
    }

    const worldSize = options.size ?? DEFAULT_CSS_WORLD_SIZE
    const fontPixelSize = getCssFontPixelSize(worldSize)
    const fontDeclaration = getCssFontDeclaration(options, fontPixelSize)

    await document.fonts.load(fontDeclaration, CSS_PRELOAD_TEXT)
    await document.fonts.ready
}

async function buildGeometryText(
    text: string,
    options: FontBuildOptions,
): Promise<Group> {
    const fontUrl = options.fontUrl ?? DEFAULT_GEOMETRY_FONT_URL
    const font = (await preloadGeometryFont(fontUrl)) as FontLike
    const size = options.size ?? 80
    const strokeWidth = options.strokeWidth ?? Math.max(1, size * 0.0625)
    const fillOpacity = clamp01(options.fillOpacity ?? DEFAULT_FILL_OPACITY)
    const fillOffsetZ =
        options.fillOffsetZ ?? -Math.max(size * 0.02, strokeWidth * 0.5)
    const direction = options.direction ?? "ltr"
    const curveSegments = options.curveSegments ?? 12
    const centerX = options.centerX ?? true
    const fillColor = toColor(options.fillColor ?? DEFAULT_FILL_COLOR)
    const strokeColor = toColor(options.strokeColor ?? DEFAULT_STROKE_COLOR)

    const strokeText = new Group()
    strokeText.name = options.name ?? "FontsText"
    strokeText.userData.text = text
    strokeText.userData.fontUrl = fontUrl

    const shapes = font.generateShapes(text, size, direction)
    const textGeometry = new ShapeGeometry(shapes)
    textGeometry.computeBoundingBox()

    const xOffset = centerX ? getCenterOffsetX(textGeometry.boundingBox) : 0
    textGeometry.translate(xOffset, 0, 0)

    const fillMaterial = createSolidMaterial(fillColor, fillOpacity)
    const fillMesh = new Mesh(textGeometry, fillMaterial)
    fillMesh.position.z = fillOffsetZ
    fillMesh.castShadow = false
    fillMesh.receiveShadow = false
    fillMesh.renderOrder = 0
    strokeText.add(fillMesh)

    const strokeShapes: any[] = [...shapes]

    for (const shape of shapes) {
        if (!shape.holes || shape.holes.length === 0) {
            continue
        }

        strokeShapes.push(...shape.holes)
    }

    const strokeMaterial = createSolidMaterial(strokeColor, 1)
    const strokeStyle = SVGLoader.getStrokeStyle(
        strokeWidth,
        strokeColor.getStyle(),
    )

    for (const shape of strokeShapes) {
        const geometry = SVGLoader.pointsToStroke(
            shape.getPoints(curveSegments),
            strokeStyle,
        )

        if (!geometry) {
            continue
        }

        geometry.translate(xOffset, 0, 0)

        const strokeMesh = new Mesh(geometry, strokeMaterial)
        strokeMesh.castShadow = false
        strokeMesh.receiveShadow = false
        strokeMesh.renderOrder = 1
        strokeText.add(strokeMesh)
    }

    return strokeText
}

function buildCssText(text: string, options: FontBuildOptions): Group {
    if (typeof document === "undefined") {
        throw new Error("Fonts.build() requires a DOM environment.")
    }

    const worldSize = options.size ?? DEFAULT_CSS_WORLD_SIZE
    const fontPixelSize = getCssFontPixelSize(worldSize)
    const pixelsPerWorldUnit = fontPixelSize / worldSize
    const lineHeightMultiplier = options.lineHeight ?? DEFAULT_CSS_LINE_HEIGHT
    const lineHeightPixels = Math.ceil(fontPixelSize * lineHeightMultiplier)
    const strokeWidthWorld =
        options.strokeWidth ?? Math.max(worldSize * 0.07, 0.08)
    const strokeWidthPixels = Math.max(
        1,
        Math.round(strokeWidthWorld * pixelsPerWorldUnit),
    )
    const paddingWorld = options.padding ?? Math.max(strokeWidthWorld * 2, 0.2)
    const paddingPixels = Math.ceil(paddingWorld * pixelsPerWorldUnit)
    const fillOpacity = clamp01(options.fillOpacity ?? DEFAULT_FILL_OPACITY)
    const fillOffsetZ = options.fillOffsetZ ?? 0.012
    const centerX = options.centerX ?? true
    const fillColor = toColor(options.fillColor ?? DEFAULT_FILL_COLOR)
    const strokeColor = toColor(options.strokeColor ?? DEFAULT_STROKE_COLOR)
    const lines = text.split("\n")
    const fontDeclaration = getCssFontDeclaration(options, fontPixelSize)

    const measureCanvas = document.createElement("canvas")
    const measureContext = measureCanvas.getContext("2d")
    if (!measureContext) {
        throw new Error(
            "Unable to create a 2D canvas context for Fonts.build().",
        )
    }

    measureContext.font = fontDeclaration
    const lineMetrics = lines.map((line) => measureContext.measureText(line))
    const maxWidth = Math.max(
        1,
        ...lineMetrics.map((metric) => Math.ceil(metric.width)),
    )
    const maxAscent = Math.max(
        fontPixelSize,
        ...lineMetrics.map((metric) =>
            Math.ceil(metric.actualBoundingBoxAscent || fontPixelSize * 0.8),
        ),
    )
    const maxDescent = Math.max(
        Math.ceil(fontPixelSize * 0.2),
        ...lineMetrics.map((metric) =>
            Math.ceil(metric.actualBoundingBoxDescent || fontPixelSize * 0.2),
        ),
    )

    const canvasWidth = Math.ceil(maxWidth + paddingPixels * 2)
    const canvasHeight = Math.ceil(
        lineHeightPixels * Math.max(lines.length - 1, 0) +
            maxAscent +
            maxDescent +
            paddingPixels * 2,
    )

    const canvas = document.createElement("canvas")
    canvas.width = canvasWidth
    canvas.height = canvasHeight

    const context = canvas.getContext("2d")
    if (!context) {
        throw new Error(
            "Unable to create a 2D canvas context for Fonts.build().",
        )
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = fontDeclaration
    context.textAlign = centerX ? "center" : "left"
    context.textBaseline = "alphabetic"
    context.lineJoin = "round"
    context.lineCap = "round"
    context.miterLimit = 2
    context.lineWidth = strokeWidthPixels
    context.strokeStyle = colorToCanvas(
        fillOpacity === 0 ? strokeColor : strokeColor,
        1,
    )
    context.fillStyle = colorToCanvas(fillColor, fillOpacity)

    const drawX = centerX ? canvas.width * 0.5 : paddingPixels
    const baselineY = paddingPixels + maxAscent

    lines.forEach((line, index) => {
        const y = baselineY + index * lineHeightPixels
        context.strokeText(line, drawX, y)
        if (fillOpacity > 0) {
            context.fillText(line, drawX, y)
        }
    })

    const textTexture = new CanvasTexture(canvas)
    textTexture.colorSpace = SRGBColorSpace
    textTexture.minFilter = LinearFilter
    textTexture.magFilter = LinearFilter
    textTexture.needsUpdate = true

    const geometry = new PlaneGeometry(
        canvas.width / pixelsPerWorldUnit,
        canvas.height / pixelsPerWorldUnit,
    )
    const material = createTextureMaterial(textTexture)
    const textMesh = new Mesh(geometry, material)
    textMesh.position.z = fillOffsetZ
    textMesh.castShadow = false
    textMesh.receiveShadow = false
    textMesh.renderOrder = 1
    textMesh.userData.textTexture = textTexture

    const textGroup = new Group()
    textGroup.name = options.name ?? "FontsText"
    textGroup.userData.text = text
    textGroup.userData.fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY
    textGroup.add(textMesh)

    return textGroup
}

async function loadGeometryFont(fontUrl: string): Promise<Font> {
    if (fontUrl.endsWith(".zip")) {
        fileLoader.setResponseType("arraybuffer")
        const data = (await fileLoader.loadAsync(fontUrl)) as ArrayBuffer
        const zip = unzipSync(new Uint8Array(data))
        const fontEntry = Object.keys(zip).find((entryName) =>
            entryName.endsWith(".typeface.json"),
        )

        if (!fontEntry) {
            throw new Error(
                `Font archive '${fontUrl}' does not contain a .typeface.json file.`,
            )
        }

        const json = JSON.parse(strFromU8(zip[fontEntry]))
        return fontLoader.parse(json)
    }

    return fontLoader.loadAsync(fontUrl)
}

function createSolidMaterial(
    materialColor: Color,
    opacity: number,
): MeshDefaultMaterial | MeshBasicMaterial {
    const clampedOpacity = clamp01(opacity)
    const isTransparent = clampedOpacity < 1

    try {
        return new MeshDefaultMaterial({
            colorNode: color(0x000000),
            emissionNode: color(materialColor),
            alphaNode: float(clampedOpacity),
            transparent: isTransparent,
            depthWrite: !isTransparent,
            side: DoubleSide,
            shadowSide: DoubleSide,
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
            reorientDoubleSidedNormals: false,
        })
    } catch {
        return new MeshBasicMaterial({
            color: materialColor,
            transparent: isTransparent,
            opacity: clampedOpacity,
            depthWrite: !isTransparent,
            side: DoubleSide,
        })
    }
}

function createTextureMaterial(
    textTexture: CanvasTexture,
): MeshDefaultMaterial | MeshBasicMaterial {
    try {
        return new MeshDefaultMaterial({
            colorNode: texture(textTexture),
            emissionNode: color("#fefaf804").div(8),
            alphaNode: texture(textTexture).a,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            shadowSide: DoubleSide,
            hasCoreShadows: false,
            hasDropShadows: false,
            hasLightBounce: false,
            hasFog: false,
            reorientDoubleSidedNormals: false,
        })
    } catch {
        return new MeshBasicMaterial({
            map: textTexture,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
        })
    }
}

function getCssFontDeclaration(
    options: FontBuildOptions,
    fontPixelSize: number,
): string {
    const fontStyle = options.fontStyle ?? DEFAULT_FONT_STYLE
    const fontWeight = options.fontWeight ?? DEFAULT_FONT_WEIGHT
    const fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY

    return `${fontStyle} ${fontWeight} ${fontPixelSize}px ${fontFamily}`
}

function getCssFontPixelSize(worldSize: number): number {
    return Math.max(64, Math.round(worldSize * DEFAULT_CSS_RESOLUTION))
}

function toColor(colorValue: FontColorValue): Color {
    if (colorValue instanceof Color) {
        return colorValue.clone()
    }

    return new Color(colorValue)
}

function colorToCanvas(materialColor: Color, opacity: number): string {
    const red = Math.round(materialColor.r * 255)
    const green = Math.round(materialColor.g * 255)
    const blue = Math.round(materialColor.b * 255)

    return `rgba(${red}, ${green}, ${blue}, ${clamp01(opacity)})`
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value))
}

function getCenterOffsetX(boundingBox: Box3 | null): number {
    if (!boundingBox) {
        return 0
    }

    return -(boundingBox.min.x + boundingBox.max.x) * 0.5
}

export const Fonts = {
    preload,
    build,
    dispose,
}

import type { FolderApi } from "@tweakpane/core"
import { color, float, uniform } from "three/tsl"
import {
    BufferGeometry,
    CameraHelper,
    Color,
    DirectionalLight,
    IcosahedronGeometry,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicNodeMaterial,
    Spherical,
    Vector3,
} from "three/webgpu"
import { TweakPane } from "./TweakPane"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import { Scene } from "./Scene"
import type { Camera } from "./Camera"

const NIGHT_PRESET = {
    lightColor: new Color("#6f8dee"),
    lightIntensity: 3.8,
    shadowColor: new Color("#2f00db"),
}

interface LightingConfig {
    phi: number
    theta: number
    distance: number

    // System Shadow
    shadowBias: number
    shadowNormalBias: number
    shadowRadius: number
    shadowAmplitude: number

    // Stylized Shader Props
    coreShadowEdgeLow: number
    coreShadowEdgeHigh: number
    lightBounceEdgeLow: number
    lightBounceEdgeHigh: number
    lightBounceDistance: number
    lightBounceMultiplier: number
}

@injectable()
export class Lighting {
    private debugPanel: FolderApi | undefined

    public light!: DirectionalLight
    public direction!: UniformNode<Vector3>

    // TSL Uniforms (Single Source of Truth)
    // 쉐이더와 CPU 간의 실시간 데이터 통로
    public directionUniform!: UniformNode<Vector3>
    public colorUniform!: UniformNode<Color>
    public intensityUniform!: UniformNode<number>

    // Stylized Shader Uniforms
    public lightBounceEdgeLow!: UniformNode<number>
    public lightBounceEdgeHigh!: UniformNode<number>
    public lightBounceDistance!: UniformNode<number>
    public lightBounceMultiplier!: UniformNode<number>
    public shadowColor!: UniformNode<Color>
    public bounceColor!: UniformNode<Color>
    public coreShadowEdgeLow!: UniformNode<number>
    public coreShadowEdgeHigh!: UniformNode<number>

    // Logic State
    public spherical!: Spherical

    // Debug Options
    public debugOptions = {
        followCamera: true, // 빛이 카메라 타겟을 따라다닐지 여부
        showDirectionHelper: false,
        showShadowHelper: false,
        lightColor: "#ffffff",
        shadowColor: "#3d3d3d",
        bounceColor: "#1a4d2e",
    }

    // Shadow Config (System)
    public mapSize: number = 2048
    public near: number = 0.1
    public depth: number = 100

    // Helpers
    private directionHelper!: Mesh
    private shadowHelper!: CameraHelper

    constructor(@inject(GAME_CONTEXT.Scene) private scene: Scene, @inject(GAME_CONTEXT.Camera) private camera: Camera) { }

    public initialize() {
        // 1. 초기값 설정 (Default Settings)
        const config: LightingConfig = {
            phi: 0.1, // 수직 각도 (0 ~ PI)
            theta: 0.5, // 수평 회전 (0 ~ 2PI)
            distance: 50, // 빛의 거리

            // Shadow System (Acne 제거용)
            shadowBias: -0.0005,
            shadowNormalBias: 0.03,
            shadowRadius: 2,
            shadowAmplitude: 30, // 그림자 투영 범위 (작을수록 선명)

            // Stylized (Toon/Bounce)
            coreShadowEdgeLow: -0.25, // 명암 경계 부드러움 조절
            coreShadowEdgeHigh: 1,
            lightBounceEdgeLow: 0.1,
            lightBounceEdgeHigh: 1,
            lightBounceDistance: 0.6, // 반사광이 도달하는 높이
            lightBounceMultiplier: 0.4, // 반사광 강도
        }

        // 2. 객체 초기화
        this.spherical = new Spherical(
            config.distance,
            config.phi,
            config.theta,
        )

        this.direction = uniform(
            new Vector3().setFromSpherical(this.spherical).normalize(),
        )

        // 3. Uniform 생성 (Material들이 참조할 값들)
        this.directionUniform = uniform(this.direction)
        this.colorUniform = uniform(color(NIGHT_PRESET.lightColor))
        this.intensityUniform = uniform(NIGHT_PRESET.lightIntensity)

        // Stylized Nodes
        this.lightBounceEdgeLow = uniform(float(config.lightBounceEdgeLow))
        this.lightBounceEdgeHigh = uniform(float(config.lightBounceEdgeHigh))
        this.lightBounceDistance = uniform(float(config.lightBounceDistance))
        this.lightBounceMultiplier = uniform(
            float(config.lightBounceMultiplier),
        )

        this.shadowColor = uniform(color(NIGHT_PRESET.shadowColor))
        this.bounceColor = uniform(color(this.debugOptions.bounceColor))

        this.coreShadowEdgeLow = uniform(float(config.coreShadowEdgeLow))
        this.coreShadowEdgeHigh = uniform(float(config.coreShadowEdgeHigh))

        // 4. Light & Helpers 생성
        this.createLight(config)
        this.createHelpers()

        // 5. 디버그 패널 생성
        this.createDebugPanel(config)
    }

    private createShadow(config: LightingConfig) {
        if (!this.light) {
            return
        }

        const shadowSize = config.distance
        this.light.shadow.mapSize.set(this.mapSize, this.mapSize)
        this.light.shadow.camera.top = shadowSize
        this.light.shadow.camera.right = shadowSize
        this.light.shadow.camera.bottom = -shadowSize
        this.light.shadow.camera.left = -shadowSize
        this.light.shadow.camera.near = 1
        this.light.shadow.camera.far = config.distance * 2
        this.light.shadow.bias = -0.001
        this.light.shadow.normalBias = 0.1
        this.light.shadow.radius = 3
    }

    private createLight(config: LightingConfig) {
        this.light = new DirectionalLight(
            NIGHT_PRESET.lightColor,
            NIGHT_PRESET.lightIntensity,
        )
        this.light.position.setFromSpherical(this.spherical)
        this.light.castShadow = true
        this.createShadow(config)
        // 그림자 카메라 설정 적용
        this.updateShadowCamera(config)

        this.scene.add(this.light)
        this.scene.add(this.light.target)
    }

    private createHelpers() {
        // 빛의 방향을 보여주는 화살표
        this.directionHelper = new Mesh(
            new IcosahedronGeometry(0.5, 1),
            new MeshBasicNodeMaterial({
                color: 0xffff00,
                wireframe: true,
            }),
        )
        this.directionHelper.visible = false

        const lineGeo = new BufferGeometry().setFromPoints([
            new Vector3(0, 0, 0),
            new Vector3(0, 0, 10),
        ])
        this.directionHelper.add(
            new Line(lineGeo, new LineBasicMaterial({ color: 0xffff00 })),
        )
        this.scene.add(this.directionHelper)

        // 그림자 영역을 보여주는 박스
        this.shadowHelper = new CameraHelper(this.light.shadow.camera)
        this.shadowHelper.visible = false
        this.scene.add(this.shadowHelper)
    }

    private updateShadowCamera(config: LightingConfig) {
        const cam = this.light.shadow.camera
        const amp = config.shadowAmplitude

        cam.top = amp
        cam.right = amp
        cam.bottom = -amp
        cam.left = -amp
        cam.near = this.near
        cam.far = this.near + this.depth

        this.light.shadow.bias = config.shadowBias
        this.light.shadow.normalBias = config.shadowNormalBias
        this.light.shadow.radius = config.shadowRadius

        cam.updateProjectionMatrix()

        if (this.shadowHelper) this.shadowHelper.update()
    }

    private createDebugPanel(config: LightingConfig) {
        const searchParams = new URLSearchParams(window.location.search)
        const debug = searchParams.get("debug") === "lighting"
        if (!debug) {
            return
        }

        const pane = TweakPane.getInstance()
        this.debugPanel = pane.addFolder({
            title: "💡 Lighting System",
            expanded: true,
        })

        // --- 1. Position & Direction ---
        const fPos = this.debugPanel.addFolder({
            title: "☀️ Position & Direction",
        })

        fPos.addBinding(this.debugOptions, "followCamera", {
            label: "Follow Camera",
        })

        fPos.addBinding(this.spherical, "phi", {
            min: -(Math.PI - 0.01),
            max: Math.PI - 0.01,
            step: 0.01,
            label: "Phi (V-Angle)",
        }).on("change", () => this.update())

        fPos.addBinding(this.spherical, "theta", {
            min: 0,
            max: Math.PI * 2,
            step: 0.01,
            label: "Theta (H-Angle)",
        }).on("change", () => this.update())

        fPos.addBinding(this.spherical, "radius", {
            min: 10,
            max: 200,
            label: "Distance",
        }).on("change", () => this.update())

        fPos.addBinding(this.debugOptions, "showDirectionHelper", {
            label: "Show Dir Helper",
        }).on("change", (ev) => {
            this.directionHelper.visible = ev.value
        })

        // --- 2. Light Properties ---
        const fLight = this.debugPanel.addFolder({ title: "🎨 Light Colors" })

        fLight.addBinding(this.intensityUniform, "value", {
            min: 0,
            max: 5,
            label: "Intensity",
        })

        fLight
            .addBinding(this.debugOptions, "lightColor", {
                view: "color",
                label: "Sun Color",
            })
            .on("change", (ev) => this.colorUniform.value.set(ev.value))

        fLight
            .addBinding(this.debugOptions, "shadowColor", {
                view: "color",
                label: "Shadow Tint",
            })
            .on("change", (ev) => this.shadowColor.value.set(ev.value))

        // --- 3. Shadow System (Technical) ---
        const fShadow = this.debugPanel.addFolder({
            title: "🌑 Shadow System (Bias)",
        })

        fShadow
            .addBinding(this.debugOptions, "showShadowHelper", {
                label: "Show Frustum",
            })
            .on("change", (ev) => {
                this.shadowHelper.visible = ev.value
            })

        fShadow
            .addBinding(config, "shadowAmplitude", {
                min: 5,
                max: 100,
                label: "Frustum Size",
            })
            .on("change", (ev) =>
                this.updateShadowCamera({
                    ...config,
                    shadowAmplitude: ev.value,
                }),
            )

        fShadow
            .addBinding(config, "shadowBias", {
                min: -0.01,
                max: 0.01,
                step: 0.0001,
                label: "Bias",
            })
            .on("change", (ev) =>
                this.updateShadowCamera({ ...config, shadowBias: ev.value }),
            )

        fShadow
            .addBinding(config, "shadowNormalBias", {
                min: 0,
                max: 0.2,
                step: 0.001,
                label: "Normal Bias",
            })
            .on("change", (ev) =>
                this.updateShadowCamera({
                    ...config,
                    shadowNormalBias: ev.value,
                }),
            )

        fShadow
            .addBinding(config, "shadowRadius", {
                min: 0,
                max: 10,
                step: 0.5,
                label: "Blur Radius",
            })
            .on("change", (ev) =>
                this.updateShadowCamera({ ...config, shadowRadius: ev.value }),
            )

        // --- 4. Stylized Shader Control (Artistic) ---
        const fStyle = this.debugPanel.addFolder({ title: "🖌️ Toon & Bounce" })

        fStyle.addBinding(this.coreShadowEdgeLow, "value", {
            min: -1,
            max: 1,
            label: "Shadow Softness A",
        })
        fStyle.addBinding(this.coreShadowEdgeHigh, "value", {
            min: -1,
            max: 1,
            label: "Shadow Softness B",
        })

        fStyle
            .addBinding(this.debugOptions, "bounceColor", {
                view: "color",
                label: "Bounce Color",
            })
            .on("change", (ev) => this.bounceColor.value.set(ev.value))

        fStyle.addBinding(this.lightBounceMultiplier, "value", {
            min: -50,
            max: 50,
            step: 0.01,
            label: "Bounce Strength",
        })
        fStyle.addBinding(this.lightBounceDistance, "value", {
            min: -50,
            max: 50,
            step: 0.01,
            label: "Bounce Height",
        })
    }

    public update() {
        // 1. 구면 좌표계 기반 상대 위치 계산
        // (항상 카메라 타겟을 원점으로 생각하고 오프셋을 계산)
        const offset = new Vector3().setFromSpherical(this.spherical)

        // 2. 타겟 위치 결정
        // debugOptions.followCamera가 true면 카메라 타겟을, 아니면 (0,0,0)을 바라봄
        const targetPos = new Vector3(0, 0, 0)

        if (this.debugOptions.followCamera && this.camera.orbitControls) {
            targetPos.copy(this.camera.orbitControls.target)
        }

        // 3. 조명 위치 업데이트 (Target + Offset)
        this.light.position.copy(targetPos).add(offset)
        this.light.target.position.copy(targetPos)
        this.light.target.updateMatrixWorld() // 매우 중요: 매트릭스 갱신

        // 4. 빛의 방향 벡터 계산 (쉐이더용)
        // Light Pos -> Target Pos 방향의 정규화된 벡터
        this.direction.value
            .subVectors(this.light.position, this.light.target.position)
            .normalize()

        // 6. Helpers 업데이트
        if (this.debugOptions.showDirectionHelper) {
            this.directionHelper.position.copy(this.light.position)
            this.directionHelper.lookAt(this.light.target.position)
        }

        if (this.debugOptions.showShadowHelper) {
            this.shadowHelper.update()
        }
    }
}

import * as THREE from "three/webgpu"
import { TweakPane } from "@/widgets/TweakPane"

export interface ProjectData {
    id: string
    title: string
    description: string
    url: string
    tags: string[]
    position: THREE.Vector3
}

export class ProjectRegistry {
    private static instance: ProjectRegistry
    private projects: ProjectData[] = []
    private projectPosition: THREE.Vector3 = new THREE.Vector3(25.2, 0, 20.2)

    private constructor() {
        this.initializeDefaultProjects()
    }

    public static getInstance(): ProjectRegistry {
        if (!ProjectRegistry.instance) {
            ProjectRegistry.instance = new ProjectRegistry()
        }
        return ProjectRegistry.instance
    }

    private initializeDefaultProjects() {
        // 플레이스홀더 데이터를 초기화합니다.
        this.projects.push(
            {
                id: "threejs-journey",
                title: "Three.js Journey",
                description:
                    "The best way to learn Three.js. Comprehensive course from basics to advanced shaders.",
                url: "https://threejs-journey.com",
                tags: ["Education", "Three.js", "WebGL"],
                position: this.projectPosition,
            },
            {
                id: "chartogne-taillet",
                title: "Chartogne Taillet",
                description:
                    "A premium 3D experience for a prestigious Champagne house.",
                url: "https://chartogne-taillet.com",
                tags: ["Luxury", "Experience", "SVG"],
                position: new THREE.Vector3(-12, 0, 28),
            },
        )

        // this.debug()
    }

    // 32 0 8
    // 25.2 0 20.2

    public debug() {
        const pane = TweakPane.getInstance()
        const folder = pane.addFolder({ title: "Project Position" })
        folder.addBinding(this.projectPosition, "x", {
            min: -1000,
            max: 1000,
            step: 0.1,
        })
        folder.addBinding(this.projectPosition, "y", {
            min: -1000,
            max: 1000,
            step: 0.1,
        })
        folder.addBinding(this.projectPosition, "z", {
            min: -1000,
            max: 1000,
            step: 0.1,
        })
    }

    public getProjects(): ProjectData[] {
        return this.projects
    }

    public getProjectById(id: string): ProjectData | undefined {
        return this.projects.find((p) => p.id === id)
    }
}

import * as THREE from "three/webgpu"
import { TweakPane } from "@/widgets/TweakPane"

export interface ProjectData {
    id: string
    title: string
    description: string
    url: string
    tags: string[]
    position: THREE.Vector3
    image?: string
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
                id: "sunub-blog",
                title: "Sunub Blog",
                description:
                    "AWS 인프라 기반의 CI/CD 파이프라인과 성능 최적화를 적용하여 직접 배포·운영 중인 풀스택 블로그 프로젝트",
                url: "https://sunub.site/",
                tags: [
                    "React",
                    "TypeScript",
                    "Next.js",
                    "NestJS",
                    "MDX",
                    "Vitest",
                    "Framer-motion",
                    "Styled-Components",
                    "Playwright",
                ],
                position: this.projectPosition,
            },
            {
                id: "github",
                title: "Github Page",
                description:
                    "sunub가 작업 중인 프로젝트들을 확인 할 수 있습니다.",
                url: "https://github.com/sunub",
                tags: [],
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

import { Vector3 } from "three/webgpu"

export interface ProjectData {
    id: string
    title: string
    description: string
    url: string
    tags: string[]
    position: Vector3
    image?: string
}

export class Project {
    private projects: ProjectData[] = []

    private constructor() {
        this.initializeDefaultProjects()
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
                position: new Vector3(25.2, 0, 20.2),
            },
            {
                id: "github",
                title: "Github Page",
                description:
                    "sunub가 작업 중인 프로젝트들을 확인 할 수 있습니다.",
                url: "https://github.com/sunub",
                tags: [],
                position: new Vector3(-12, 0, 28),
            },
        )
    }

    public getProjects(): ProjectData[] {
        return this.projects
    }

    public getProjectById(id: string): ProjectData | undefined {
        return this.projects.find((p) => p.id === id)
    }
}

import { Vector3 } from "three/webgpu"
import type { ProjectOutpost } from "../Models/ProjectOutpost"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"
import type { RigidBody } from "@dimforge/rapier3d-compat"

export interface ProjectData {
    id: string
    title: string
    description: string
    url: string
    tags: string[]
    position: Vector3
    image?: string
}

@injectable()
export class ProjectManager {
    public outposts: ProjectOutpost[] = []
    private lastInteractionTime: number = 0
    private readonly INTERACTION_COOLDOWN: number = 500
    private projects: ProjectData[] = [
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
    ]

    constructor(
        @inject(GAME_CONTEXT.FACTORY.ProjectOutpostFactory) private projectOutpostFactory: (projectData: ProjectData) => ProjectOutpost,
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {
        this.eventBus.on(GameEvents.PLAYER_READY, (payload) => {
            this.setTrackingTargets(payload.spaceshipRigidBody)
        })
    }

    public async initialize() {
        const projectObjectPromise = this.projects.map(async (data) => {
            const outpost = this.projectOutpostFactory(data);
            await outpost.initialize(false);
            return outpost
        })

        this.outposts = await Promise.all(projectObjectPromise)
    }

    public attachPreparedOutposts(): void {
        this.outposts.forEach((outpost) => {
            outpost.attachToScene?.()
        })
    }

    public setOutpostsVisible(visible: boolean): void {
        this.outposts.forEach((outpost) => {
            outpost.setVisible?.(visible)
        })
    }

    private setTrackingTargets(shipBody: RigidBody) {
        this.outposts.forEach(outpost => {
            outpost.setTrackingTarget(shipBody);
        });
    }

    public getProjects(): ProjectData[] {
        return this.projects
    }

    public handleInteraction() {
        const now = Date.now()
        if (now - this.lastInteractionTime < this.INTERACTION_COOLDOWN) {
            return
        }
        this.lastInteractionTime = now
        const activeOutpost = this.outposts.find(outpost => outpost.isInside)
        if(activeOutpost) {
            this.eventBus.emit(GameEvents.PROJECT_INTERACTION_REQUESTED, {
                project: activeOutpost.data
            })
        }
    }

    public update(deltaTime: number): void {
        for (const outpost of this.outposts) {
            outpost.update(deltaTime)
        }
    }

    public getProjectById(id: string): ProjectData | undefined {
        return this.projects.find((p) => p.id === id)
    }
}

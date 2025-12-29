import * as THREE from "three"

export interface ProjectData
{
	id: string
	title: string
	description: string
	url: string
	tags: string[]
	position: THREE.Vector3
}

export class ProjectRegistry
{
	private static instance: ProjectRegistry
	private projects: ProjectData[] = []

	private constructor()
	{
		this.initializeDefaultProjects()
	}

	public static getInstance(): ProjectRegistry
	{
		if (!ProjectRegistry.instance)
		{
			ProjectRegistry.instance = new ProjectRegistry()
		}
		return ProjectRegistry.instance
	}

	private initializeDefaultProjects()
	{
		// 플레이스홀더 데이터를 초기화합니다.
		this.projects.push(
			{
				id: "threejs-journey",
				title: "Three.js Journey",
				description:
					"The best way to learn Three.js. Comprehensive course from basics to advanced shaders.",
				url: "https://threejs-journey.com",
				tags: ["Education", "Three.js", "WebGL"],
				position: new THREE.Vector3(35, 0, 0),
			},
			{
				id: "chartogne-taillet",
				title: "Chartogne Taillet",
				description:
					"A premium 3D experience for a prestigious Champagne house.",
				url: "https://chartogne-taillet.com",
				tags: ["Luxury", "Experience", "SVG"],
				position: new THREE.Vector3(0, 0, 40),
			},
			{
				id: "bruno-simon",
				title: "Bruno Simon Portfolio",
				description:
					"The legendary toy car portfolio that inspired this project.",
				url: "https://brunosimon.com",
				tags: ["Portfolio", "Game", "Physics"],
				position: new THREE.Vector3(-35, 0, 0),
			},
		)
	}

	public getProjects(): ProjectData[]
	{
		return this.projects
	}

	public getProjectById(id: string): ProjectData | undefined
	{
		return this.projects.find((p) => p.id === id)
	}
}

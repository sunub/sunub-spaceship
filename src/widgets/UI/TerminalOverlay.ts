import gsap from "gsap"
import type { GameContext } from "@/core/GameContext"
import type { ProjectData } from "@/core/ProjectRegistry"

export class TerminalOverlay {
    private element: HTMLElement
    private isVisible: boolean = false
    private isHiding: boolean = false

    constructor(private context: GameContext) {
        this.element = document.createElement("main")
        this.element.id = "project-terminal"
        this.element.className = "main-content"

        document.body.appendChild(this.element)
    }

    public show(project: ProjectData) {
        if (this.isVisible && !this.isHiding) return

        this.isVisible = true
        this.isHiding = false
        this.element.style.visibility = "visible"
        this.element.style.opacity = "1"
        this.element.style.pointerEvents = "auto"

        this.element.innerHTML = `
        <div class="header-top">
            <span class="header-id">ID: #${project.id}</span>
            <div class="status-badge">
                <span class="status-dot"></span>
                <span class="status-text">System Active</span>
            </div>
        </div>
        <div class="container">
				<header class="header">
                    <div class="header-bottom">
                        <div class="logo-container">
					    	<div class="logo-bg-glow"></div>
					    	<div class="logo-content">
					    		<div class="ring-1"></div>
					    		<div class="ring-2"></div>
					    		<div class="core-wrapper">
					    			<div class="core-gradient-1"></div>
					    			<div class="core-gradient-2"></div>
					    			<div class="diamond"></div>
					    		</div>
					    	</div>
					    </div>

					    <div class="title-wrapper">
						    <h1>${project.title}</h1>
						    <div class="title-divider"></div>
					    </div>
                    </div>
				</header>

				<div class="visual-area">
					<div class="glass-card">
						<div class="card-accent"></div>
						<h3 class="card-label">
							<span
								class="material-symbols-outlined"
								style="font-size: 1.25rem;"
							>
								rocket_launch
							</span>
							Mission Brief
						</h3>
						<p class="card-desc">
							${project.description}
						</p>
					</div>

					<div class="specs-wrapper">
						<h3 class="specs-label">System Specifications</h3>
						<div class="tags-container">
                            ${project.tags.map((tag) => `<span class="tag tag-default">${tag}</span>`).join("")}
						</div>
					</div>

				    <div class="grow"></div>

					<div class="button-grid">
						<button type="button" class="btn btn-back">
							<span
								class="material-symbols-outlined"
								style="font-size: 1.5rem;"
							>
								arrow_back
							</span>
							Back to Flight
						</button>
						<button type="button" class="btn btn-launch">
							<span
								class="material-symbols-outlined"
								style="font-size: 1.5rem; animation: pulse 2s infinite;"
							>
								rocket
							</span>
							Launch Project
						</button>
					</div>
				</div>
			</div>
        `

        const content = this.element.querySelector(".glass-card") as HTMLElement

        gsap.fromTo(
            content,
            { opacity: 0, scale: 0.9 },
            {
                opacity: 1,
                scale: 1,
                duration: 0.5,
                ease: "back.out(1.7)",
                overwrite: true,
            },
        )

        this.element
            .querySelector(".btn-launch")
            ?.addEventListener("click", () => {
                window.open(project.url, "_blank")
            })

        this.element
            .querySelector(".btn-back")
            ?.addEventListener("click", () => {
                this.hide()
            })
    }

    public hide() {
        if (!this.isVisible || this.isHiding) return

        this.isHiding = true
        this.context.game.spaceShip.joyStick.unlock()

        const content = this.element.querySelector(".glass-card") as HTMLElement

        if (content) {
            gsap.to(content, {
                opacity: 0,
                scale: 0.9,
                y: 20,
                duration: 0.3,
                ease: "power2.in",
                overwrite: true,
                onComplete: () => {
                    this.element.style.visibility = "hidden"
                    this.element.style.opacity = "0"
                    this.element.style.pointerEvents = "none"
                    this.isVisible = false
                    this.isHiding = false
                    this.element.innerHTML = ""
                },
            })
        } else {
            this.element.style.visibility = "hidden"
            this.element.style.opacity = "0"
            this.element.style.pointerEvents = "none"
            this.isVisible = false
            this.isHiding = false
            this.element.innerHTML = ""
        }
    }

    public get isOpen(): boolean {
        return this.isVisible && !this.isHiding
    }
}

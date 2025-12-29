import gsap from "gsap"
import type { ProjectData } from "@/core/ProjectRegistry"

export class TerminalOverlay {
	private element: HTMLElement
	private isVisible: boolean = false

	constructor() {
		this.element = document.createElement("div")
		this.element.id = "project-terminal"
		this.element.style.position = "fixed"
		this.element.style.top = "0"
		this.element.style.left = "0"
		this.element.style.width = "100%"
		this.element.style.height = "100%"
		this.element.style.zIndex = "1000"
		this.element.style.display = "none"
		this.element.style.alignItems = "center"
		this.element.style.justifyContent = "center"
		this.element.style.background = "rgba(0, 5, 20, 0.8)"
		this.element.style.backdropFilter = "blur(20px)"
		this.element.style.fontFamily = "'Inter', sans-serif"
		this.element.style.color = "#ffffff"

		document.body.appendChild(this.element)
	}

	public show(project: ProjectData) {
		if (this.isVisible) return
		this.isVisible = true

		this.element.innerHTML = `
      <div class="terminal-content" style="max-width: 600px; width: 90%; padding: 40px; border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 20px; background: rgba(0, 15, 40, 0.6); box-shadow: 0 0 50px rgba(0, 255, 255, 0.1); opacity: 0; transform: scale(0.9);">
        <div style="font-size: 0.9rem; color: #00ffff; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 10px;">Project Terminal</div>
        <h1 style="font-size: 2.5rem; margin: 0 0 20px 0; font-weight: 800; background: linear-gradient(135deg, #ffffff 0%, #00ffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${project.title}</h1>
        
        <p style="font-size: 1.1rem; line-height: 1.6; opacity: 0.9; margin-bottom: 30px;">${project.description}</p>
        
        <div style="display: flex; gap: 10px; margin-bottom: 40px; flex-wrap: wrap;">
          ${project.tags.map((tag) => `<span style="padding: 4px 12px; border-radius: 20px; background: rgba(255, 255, 255, 0.1); font-size: 0.8rem; border: 1px solid rgba(255, 255, 255, 0.1);">${tag}</span>`).join("")}
        </div>
        
        <div style="display: flex; gap: 20px;">
          <button id="launch-project" style="flex: 1; padding: 15px; border-radius: 12px; background: #00ffff; color: #000; font-weight: 700; border: none; cursor: pointer; transition: all 0.3s; font-size: 1rem;">Launch Project</button>
          <button id="close-terminal" style="flex: 1; padding: 15px; border-radius: 12px; background: transparent; color: #fff; font-weight: 600; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; transition: all 0.3s; font-size: 1rem;">Back to Flight</button>
        </div>
      </div>
    `

		this.element.style.display = "flex"
		const content = this.element.querySelector(
			".terminal-content",
		) as HTMLElement

		gsap.to(content, {
			opacity: 1,
			scale: 1,
			duration: 0.5,
			ease: "back.out(1.7)",
		})

		this.element
			.querySelector("#launch-project")
			?.addEventListener("click", () => {
				window.open(project.url, "_blank")
			})

		this.element
			.querySelector("#close-terminal")
			?.addEventListener("click", () => {
				this.hide()
			})
	}

	public hide() {
		if (!this.isVisible) return

		const content = this.element.querySelector(
			".terminal-content",
		) as HTMLElement
		gsap.to(content, {
			opacity: 0,
			scale: 0.9,
			duration: 0.3,
			onComplete: () => {
				this.element.style.display = "none"
				this.isVisible = false
			},
		})
	}

	public get isOpen(): boolean {
		return this.isVisible
	}
}

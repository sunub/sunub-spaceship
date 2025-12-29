import gsap from "gsap"
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js"
import type { ProjectData } from "@/core/ProjectRegistry"

export class ProjectHUD {
	public container: CSS2DObject
	private element: HTMLElement

	constructor(projectData: ProjectData) {
		this.element = document.createElement("div")
		this.element.className = "project-hud"
		this.element.style.color = "#ffffff"
		this.element.style.fontFamily = "'Inter', sans-serif"
		this.element.style.padding = "10px 15px"
		this.element.style.background = "rgba(0, 0, 0, 0.6)"
		this.element.style.backdropFilter = "blur(10px)"
		this.element.style.borderRadius = "8px"
		this.element.style.border = "1px solid rgba(255, 255, 255, 0.2)"
		this.element.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.3)"
		this.element.style.opacity = "0"
		this.element.style.pointerEvents = "none"
		this.element.style.textAlign = "center"
		this.element.style.transform = "translateY(10px)"
		this.element.style.transition = "transform 0.3s ease-out"

		this.element.innerHTML = `
      <div style="font-size: 0.8rem; opacity: 0.7; letter-spacing: 0.1em; margin-bottom: 4px;">PROJECT</div>
      <div style="font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">${projectData.title}</div>
      <div class="interaction-hint" style="font-size: 0.75rem; color: #00ffff; opacity: 0; transition: opacity 0.3s;">
        Press <span style="border: 1px solid #00ffff; padding: 1px 4px; border-radius: 3px;">E</span> to Open
      </div>
    `

		this.container = new CSS2DObject(this.element)
		this.container.position.set(0, 3, 0) // 바닥에서 적절한 높이로 조정
	}

	show() {
		gsap.to(this.element, {
			opacity: 1,
			y: 0,
			duration: 0.4,
			ease: "power2.out",
		})
	}

	hide() {
		gsap.to(this.element, {
			opacity: 0,
			y: 10,
			duration: 0.3,
			ease: "power2.in",
		})
	}

	setInteractionReady(ready: boolean) {
		const hint = this.element.querySelector(
			".interaction-hint",
		) as HTMLElement
		if (hint) {
			hint.style.opacity = ready ? "1" : "0"
		}
	}
}

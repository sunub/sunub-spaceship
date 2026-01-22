import gsap from "gsap"
import type { ProjectData } from "@/core/ProjectRegistry"

export class TerminalOverlay {
    private element: HTMLElement
    private isVisible: boolean = false
    private isHiding: boolean = false

    constructor() {
        this.element = document.createElement("main")
        this.element.id = "project-terminal"
        this.element.className = "main-content"

        this.element.style.position = "fixed"
        this.element.style.top = "0"
        this.element.style.left = "0"
        this.element.style.width = "100%"
        this.element.style.height = "100%"
        this.element.style.zIndex = "1000"
        this.element.style.display = "none"

        this.element.style.background = "rgba(0, 0, 0, 0.4)"
        this.element.style.backdropFilter = "blur(10px)"

        document.body.appendChild(this.element)
    }

    public show(project: ProjectData) {
        if (this.isVisible && !this.isHiding) return

        this.isVisible = true
        this.isHiding = false
        this.element.style.display = "flex"

        this.element.innerHTML = `
            <div class="content-wrapper animate-float">

                <div class="glow-backdrop"></div>

                <div class="glass-card">

                    <div class="card-sidebar">
                        <div class="id-tag">ID: #${project.id.toUpperCase()}</div>

                        <div class="image-frame-wrapper">
                            <div class="image-frame">
                                <div class="frame-content" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBhzhcCKNV6KmxzL8uVfLmlPx1vkIa7oP2RXIskZiZPw5c7r6Ai72d8fos88qT174G0CTVJyt7BjHQ5rJmxalkf8G9Sc57g60hgrrJ2ZmQtfHJUdllCjfonfwuGql0SqRhRcZr1SznY9XtUaLJns8vw8nJFO-vapPQez8snd7OzSEA79Xy9ipUxlWdYghSaMC1xX-L3spRMVljnLnYhjlSxc1kMBRZgkle9l5wnPMbSAZwGh556rIT21-fehLRNOMnXlYPT678xR2c');">
                                    <div class="frame-overlay"></div>
                                </div>
                            </div>
                            <div class="corner-deco top-left"></div>
                            <div class="corner-deco bottom-right"></div>
                        </div>

                        <div class="status-indicator">
                            <span class="status-dot-wrapper">
                                <span class="ping-animation"></span>
                                <span class="dot"></span>
                            </span>
                            VISUALIZATION ACTIVE
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="title-group">
                            <h1 class="main-title">${project.title}</h1>
                            <div class="title-underline"></div>
                        </div>

                        <div class="info-group">
                            <div class="mission-section">
                                <h3 class="section-label">Mission Brief</h3>
                                <p class="description">
                                    ${project.description}
                                </p>
                            </div>

                            <div class="specs-section">
                                <h3 class="section-label small">System Specifications</h3>
                                <div class="tags-container">
                                    ${project.tags.map((tag) => `<span class="tag tag-primary">${tag}</span>`).join("")}
                                </div>
                            </div>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-primary launch-btn">Launch Project</button>
                            <button class="btn btn-outline back-btn">
                                <span class="material-symbols-outlined">arrow_back</span>
                                Back to Flight
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="outer-deco top-right"></div>
            <div class="outer-deco bottom-left"></div>
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
            .querySelector(".launch-btn")
            ?.addEventListener("click", () => {
                window.open(project.url, "_blank")
            })

        this.element
            .querySelector(".back-btn")
            ?.addEventListener("click", () => {
                this.hide()
            })
    }

    public hide() {
        if (!this.isVisible || this.isHiding) return

        this.isHiding = true

        const content = this.element.querySelector(".glass-card") as HTMLElement

        if (content) {
            gsap.to(content, {
                opacity: 0,
                scale: 0.9,
                duration: 0.3,
                overwrite: true,
                onComplete: () => {
                    this.element.style.display = "none"
                    this.isVisible = false
                    this.isHiding = false
                },
            })
        } else {
            this.element.style.display = "none"
            this.isVisible = false
            this.isHiding = false
        }
    }

    public get isOpen(): boolean {
        return this.isVisible && !this.isHiding
    }
}

export class Notification {
    private overlay: HTMLDivElement
    private wrapper: HTMLDivElement
    private messageElement: HTMLParagraphElement
    private timer: number | null = null

    private readonly HTML_TEMPLATE = `
        <div class="toast-glow"></div>
        <div class="toast-container organic-shape">
            <div class="toast-overlay-gradient"></div>
            <div class="toast-overlay-texture"></div>

            <div class="toast-icon-wrapper">
                <div class="icon-glow"></div>
                <span class="material-symbols-outlined toast-icon">explore</span>
            </div>

            <div class="toast-content">
                <div class="toast-header">
                    <span class="toast-label">System Alert</span>
                    <div class="toast-separator"></div>
                </div>
                <p class="toast-message">
                    <!-- Message goes here -->
                </p>
            </div>

            <button type="button" class="toast-close-btn" aria-label="Dismiss">
                <div class="ember-dot"></div>
            </button>
        </div>
    `

    constructor() {
        this.overlay = document.createElement("div")
        this.overlay.className = "notification-overlay hidden"

        this.wrapper = document.createElement("div")
        this.wrapper.className = "toast-wrapper"
        this.wrapper.setAttribute("role", "alert")
        this.wrapper.setAttribute("aria-live", "assertive")

        this.wrapper.innerHTML = this.HTML_TEMPLATE

        this.overlay.appendChild(this.wrapper)
        document.body.appendChild(this.overlay)

        this.messageElement = this.wrapper.querySelector(
            ".toast-message",
        ) as HTMLParagraphElement

        const closeBtn = this.wrapper.querySelector(".toast-close-btn")
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.hide())
        }
    }

    public show(message: string, duration: number = 3000) {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }

        if (this.messageElement) {
            this.messageElement.innerText = message
        }

        this.overlay.classList.remove("hidden")
        this.overlay.classList.add("visible")

        if (duration > 0) {
            this.timer = window.setTimeout(() => {
                this.hide()
            }, duration)
        }
    }

    public hide() {
        this.overlay.classList.remove("visible")
        this.overlay.classList.add("hidden")
    }
}

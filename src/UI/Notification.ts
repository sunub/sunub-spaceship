import { injectable } from "inversify"

@injectable()
export class Notification {
    private messageElement: HTMLParagraphElement
    private timer: number | null = null

    constructor() {
        this.messageElement = document.querySelector(
            ".toast-message",
        ) as HTMLParagraphElement

        const closeBtn = document.querySelector(".toast-close-btn")
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

        document.querySelector(".notification-overlay")?.classList.remove("hidden")
        document.querySelector(".notification-overlay")?.classList.add("visible")

        if (duration > 0) {
            this.timer = window.setTimeout(() => {
                this.hide()
            }, duration)
        }
    }

    public hide() {
        document.querySelector(".notification-overlay")?.classList.remove("visible")
        document.querySelector(".notification-overlay")?.classList.add("hidden")
    }
}

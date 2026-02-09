import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { EventBus } from "@/core/EventBus/EventBus"
import { GameEvents } from "@/core/EventBus/EventBusType"
import { Howl, Howler } from "howler"
import { inject, injectable } from "inversify"

const PLAYLIST_CONFIG = [
    {
        path: "sounds/background_nebula-the-grey-room.ogg",
        name: "background",
        volume: 0.15,
        loop: true,
        html5: true,
    },
    {
        path: "sounds/button-sound_glass.ogg",
        name: "button",
        volume: 0.3,
        loop: false,
        html5: false,
    },
    {
        path: "sounds/engine_thrusterFire.aac",
        name: "engine",
        volume: 0.1,
        loop: true,
        html5: false,
    },
    {
        path: "sounds/portal-sound_forceField.aac",
        name: "portal",
        volume: 0.15,
        loop: false,
        html5: false,
    },
] as const

export type SoundName = (typeof PLAYLIST_CONFIG)[number]["name"]

export interface SoundItem {
    config: (typeof PLAYLIST_CONFIG)[number]
    sound: Howl
}

export type Songs = Record<SoundName, SoundItem>

@injectable()
export class Audio {
    public songs: Partial<Songs> = {}
    public mute: { active: boolean } = { active: false }
    public volume: number = 0.5

    public initialized: boolean = false
    private disposables: Array<() => void> = [];

    constructor(
        @inject(GAME_CONTEXT.CORE.EventBus) private eventBus: EventBus,
    ) {
        this.loadSettings()
        this.setupVisibilityEvents()
    }

    private setupVisibilityEvents() {
        const unscribeHidden = this.eventBus.on(GameEvents.GAME_VISIBILITY_HIDDEN, () => {
            this.systemMute(true)
        })
        const unscribeVisible = this.eventBus.on(GameEvents.GAME_VISIBILITY_VISIBLE, () => {
            this.systemMute(false)
        })

        this.disposables.push(unscribeHidden, unscribeVisible)
    }

    loadSettings() {
        const savedVolume = localStorage.getItem("volumeLevel")
        const savedMute = localStorage.getItem("soundToggle")

        this.volume = savedVolume ? parseFloat(savedVolume) : 0.5
        this.mute.active = savedMute === "1"
    }

    public initAudio() {
        if (this.initialized) return
        this.initialized = true

        Howler.volume(this.volume)
        Howler.mute(this.mute.active)

        this.setPlaylist()
    }

    private setPlaylist() {
        for (const config of PLAYLIST_CONFIG) {
            this.songs[config.name] = {
                config,
                sound: new Howl({
                    src: [config.path],
                    volume: config.volume,
                    loop: config.loop,
                    html5: config.html5,
                }),
            }
        }
    }

    public play(name: SoundName) {
        this.songs[name]?.sound.play()
    }

    public isPlaying(name: SoundName) {
        return this.songs[name]?.sound.playing() ?? false
    }

    public stop(name: SoundName) {
        this.songs[name]?.sound.stop()
    }

    public showDisplay() {
        const audioStatusDisplay = document.querySelector(".audio-status-display")
        audioStatusDisplay?.classList.add("visible")
    }

    public showPanel() {
        const audioPanel = document.querySelector(".audio-panel")
        audioPanel?.classList.add("visible")
    }

    public handleSoundControl() {
        const input = document.querySelector(
            ".volume-input",
        ) as HTMLInputElement
        const wrapper = document.querySelector(".slider-wrapper") as HTMLElement
        const panel = document.querySelector(".audio-panel") as HTMLElement
        const toggleBtn = document.querySelector(
            ".panel-toggle-btn",
        ) as HTMLElement
        const toggleIcon = document.getElementById("toggle-icon") as HTMLElement

        this.updateDisplay()

        if (toggleBtn && panel) {
            toggleBtn.addEventListener("click", () => {
                const isExpanded = panel.classList.toggle("expanded")

                if (toggleIcon) {
                    toggleIcon.textContent = isExpanded ? "close" : "graphic_eq"
                }

                if (isExpanded) {
                    toggleBtn.classList.add("close-mode")
                } else {
                    toggleBtn.classList.remove("close-mode")
                }
            })
        }

        if (input && wrapper) {
            input.value = (this.volume * 100).toString()
            this.updateSliderFill(input)

            const startInteraction = () => {
                this.initAudio()
                wrapper.classList.add("active")
            }

            const endInteraction = () => {
                wrapper.classList.remove("active")
            }

            input.addEventListener("mousedown", startInteraction)
            input.addEventListener("touchstart", startInteraction, {
                passive: true,
            })

            input.addEventListener("mouseup", endInteraction)
            input.addEventListener("touchend", endInteraction)

            input.addEventListener("input", (e) => {
                this.initAudio()
                const target = e.target as HTMLInputElement
                const value = parseFloat(target.value) / 100

                this.volume = value
                Howler.volume(value)
                localStorage.setItem("volumeLevel", value.toString())

                this.updateDisplay()
                this.updateSliderFill(target)

                if (value > 0 && this.mute.active) {
                    this.muteDeactivate()
                    const muteBtn = document.querySelector(
                        ".mute-btn",
                    ) as HTMLElement
                    this.updateMuteIcon(muteBtn)
                }
            })
        }

        const button = document.querySelector(".mute-btn") as HTMLElement
        if (button) {
            this.updateMuteIcon(button)

            button.addEventListener("click", () => {
                if (this.mute.active) {
                    this.muteDeactivate()
                } else {
                    this.muteActivate()
                }
                this.updateMuteIcon(button)
                this.updateDisplay()

                if (input) this.updateSliderFill(input)
            })
        }

        document.addEventListener("click", (e) => {
            if (panel && toggleBtn && panel.classList.contains("expanded")) {
                const target = e.target as HTMLElement
                if (!panel.contains(target) && !toggleBtn.contains(target)) {
                    panel.classList.remove("expanded")
                    toggleBtn.classList.remove("close-mode")
                    if (toggleIcon) {
                        toggleIcon.textContent = "graphic_eq"
                    }
                }
            }
        })
    }

    private updateSliderFill(input: HTMLInputElement) {
        const val = parseFloat(input.value)
        input.style.background = `linear-gradient(var(--volume-input-slider-direction) ,
            var(--col-indigo) 0%,
            var(--col-purple-glow) ${val}%,
            rgba(51, 65, 85, 0.5) ${val}%,
            rgba(51, 65, 85, 0.5) 100%)`
    }

    private updateDisplay() {
        const volText = document.querySelector(
            ".audio-status-display .status-vol-text",
        ) as HTMLElement
        const volBarFill = document.querySelector(
            ".audio-status-display .status-bar-fill",
        ) as HTMLElement

        const volPercent = Math.round(this.volume * 100)

        if (volText) {
            if (this.mute.active) {
                volText.innerText = "MUTE"
            } else {
                volText.innerText = `${volPercent}%`
            }
        }

        if (volBarFill) {
            if (this.mute.active) {
                volBarFill.style.width = "0%"
                volBarFill.style.opacity = "0.5"
            } else {
                volBarFill.style.width = `${volPercent}%`
                volBarFill.style.opacity = "1"
            }
        }
    }

    public muteActivate() {
        if (this.mute.active) return

        Howler.mute(true)
        this.mute.active = true
        localStorage.setItem("soundToggle", "1")
    }

    public muteDeactivate() {
        if (!this.mute.active) return

        Howler.mute(false)
        this.mute.active = false
        localStorage.setItem("soundToggle", "0")
    }

    private updateMuteIcon(btn: HTMLElement | null) {
        if (!btn) return

        const icon = btn.querySelector(
            ".material-symbols-outlined",
        ) as HTMLElement
        if (icon) {
            icon.innerText = this.mute.active ? "volume_off" : "volume_up"
        }
    }

    public systemMute(mute: boolean) {
        if (mute) {
            Howler.mute(true)
        } else {
            if (!this.mute.active) {
                Howler.mute(false)
            }
        }
    }

    public dispose() {
        this.disposables.forEach((dispose) => {
            dispose()
        })
        this.disposables = []
    }

    public update(_: number) {}
}

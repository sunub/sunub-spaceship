import "reflect-metadata";
import { DIContainer } from "./core/DI/inversify.config";
import { GAME_CONTEXT } from "./core/DI/DITypes";
import { GameBootstrapper } from "./core/GameBootstrapper";
import { PerformanceTracker } from "./utils/PerformanceTracker";

const isTruthy = (value: string | null | undefined): boolean | null => {
    if (value === null) return null
    if (value === undefined) return null
    const normalized = value.trim().toLowerCase()
    if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes") return true
    if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no") return false
    return null
}

const isPerfTrackingFromEnv = (): boolean => {
    const raw = import.meta?.env?.VITE_PERF_TRACKING
    return isTruthy(raw) ?? false
}

const isPerfTrackingEnabled = (): boolean => {
    if (typeof window === "undefined") return isPerfTrackingFromEnv()

    const params = new URLSearchParams(window.location.search)
    const urlValue = isTruthy(params.get("perf"))
    if (urlValue !== null) return urlValue

    return isPerfTrackingFromEnv()
}

const enableOrDisablePerformanceTracker = () =>
    isPerfTrackingEnabled()
        ? PerformanceTracker.enable()
        : PerformanceTracker.disable()

const main = async () => {
    enableOrDisablePerformanceTracker()
    const gameBootstrapper = DIContainer.get<GameBootstrapper>(GAME_CONTEXT.CORE.GameBootstrapper)
    await gameBootstrapper.run()
}

main().catch(console.error)

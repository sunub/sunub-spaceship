declare global {
    var __singleton: Record<string, unknown> | undefined
}

function initSingletonStore() {
    if (!globalThis.__singleton) {
        globalThis.__singleton = {}
    }
}

export function registerSingleton<Value>(
    name: string,
    factory: () => Value,
): void {
    initSingletonStore()
    if (globalThis.__singleton && name in globalThis.__singleton) {
        throw new Error(`Singleton with name "${name}" is already registered.`)
    }

    if (globalThis.__singleton === undefined) {
        throw new Error("Singleton store is not initialized.")
    }
    globalThis.__singleton[name] = factory()
}

export function getSingleton<Value>(name: string): Value {
    initSingletonStore()
    if (!globalThis.__singleton || !(name in globalThis.__singleton)) {
        throw new Error(`Singleton with name "${name}" is not registered.`)
    }
    return globalThis.__singleton[name] as Value
}

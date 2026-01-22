export function isArray(arg: unknown): arg is Array<unknown> {
    return (
        arg !== null &&
        typeof arg === "object" &&
        typeof (arg as Iterable<unknown>)[Symbol.iterator] === "function" &&
        typeof (arg as Array<unknown>).length === "number"
    )
}

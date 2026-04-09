/**
 * 리소스 로딩 성능 측정 유틸리티.
 *
 * - `performance.mark` / `performance.measure` 로 정밀 타이밍
 * - `PerformanceResourceTiming` API 로 전송 크기·네트워크 시간 분리
 * - 네트워크(전송) vs 디코딩(DRACO/KTX2) 시간 분리 산출
 * - Phase 단위(Entry / Remaining / Rapier 등) 그룹핑
 */

interface ResourceMetric {
    name: string
    type: string
    path: string
    phase: string
    /** performance.mark → mark 간 총 소요 시간 (네트워크 + 디코드 + 파싱) */
    loadDuration: number
    /** 실제 와이어에 전송된 바이트 (0 = 캐시 히트) */
    transferSize: number
    /** 압축 바디 크기 */
    encodedBodySize: number
    /** 해제된 바디 크기 */
    decodedBodySize: number
    /** PerformanceResourceTiming.duration (DNS+TCP+TLS+TTFB+Download) */
    networkDuration: number
    /** responseEnd - responseStart (순수 다운로드 시간) */
    downloadDuration: number
    /** responseStart - requestStart */
    ttfb: number
    /** loadDuration - networkDuration (디코더/트랜스코더 오버헤드 추정) */
    decodeDuration: number
    cached: boolean
}

interface PhaseMetric {
    name: string
    startTime: number
    endTime: number
    duration: number
    resources: ResourceMetric[]
}

class PerformanceTrackerStore {
    private phases = new Map<string, PhaseMetric>()
    private currentPhase: string | null = null
    private enabled = false

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled
    }

    public isEnabled(): boolean {
        return this.enabled
    }

    public enable(): void {
        this.setEnabled(true)
    }

    public disable(): void {
        this.setEnabled(false)
    }

    // ──────────────────────────────────────────────
    // Phase tracking
    // ──────────────────────────────────────────────

    public startPhase(name: string): void {
        if (!this.enabled) return

        // Resource Timing 버퍼 확장 (기본 250개 제한 방지)
        if (typeof performance.setResourceTimingBufferSize === "function") {
            performance.setResourceTimingBufferSize(500)
        }

        performance.mark(`perf:phase:${name}:start`)
        this.phases.set(name, {
            name,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            resources: [],
        })
        this.currentPhase = name
    }

    public endPhase(name: string): void {
        if (!this.enabled) return
        const phase = this.phases.get(name)
        if (!phase) return

        performance.mark(`perf:phase:${name}:end`)
        performance.measure(
            `perf:phase:${name}`,
            `perf:phase:${name}:start`,
            `perf:phase:${name}:end`,
        )

        phase.endTime = performance.now()
        phase.duration = phase.endTime - phase.startTime
        if (this.currentPhase === name) {
            this.currentPhase = null
        }
    }

    // ──────────────────────────────────────────────
    // Per-resource tracking
    // ──────────────────────────────────────────────

    public async trackResource<T>(
        name: string,
        type: string,
        path: string,
        loadFn: () => Promise<T>,
        resourcePhase?: string,
    ): Promise<T> {
        if (!this.enabled) return loadFn()

        const markStart = `perf:res:${name}:start`
        const markEnd = `perf:res:${name}:end`

        performance.mark(markStart)
        const result = await loadFn()
        performance.mark(markEnd)

        const measure = performance.measure(
            `perf:res:${name}`,
            markStart,
            markEnd,
        )
        const loadDuration = measure.duration

        // PerformanceResourceTiming 조회 (fetch/XHR 자동 수집)
        const fullUrl = new URL(path, globalThis.location.origin).href
        const entries = performance.getEntriesByName(
            fullUrl,
            "resource",
        ) as PerformanceResourceTiming[]
        const entry = entries.at(-1) // 가장 최근 엔트리

        const networkDuration = entry?.duration ?? -1
        const decodeDuration =
            networkDuration >= 0
                ? Math.max(loadDuration - networkDuration, 0)
                : -1

        const metric: ResourceMetric = {
            name,
            type,
            path,
            phase: resourcePhase ?? this.currentPhase ?? "unknown",
            loadDuration,
            transferSize: entry?.transferSize ?? -1,
            encodedBodySize: entry?.encodedBodySize ?? -1,
            decodedBodySize: entry?.decodedBodySize ?? -1,
            networkDuration,
            downloadDuration: entry
                ? entry.responseEnd - entry.responseStart
                : -1,
            ttfb: entry ? entry.responseStart - entry.requestStart : -1,
            decodeDuration,
            cached: entry ? entry.transferSize === 0 : false,
        }

        const targetPhase = resourcePhase ?? this.currentPhase ?? "unknown"
        const phase = this.phases.get(targetPhase) ?? null
        if (phase) {
            phase.resources.push(metric)
        }

        return result
    }

    // ──────────────────────────────────────────────
    // Report
    // ──────────────────────────────────────────────

    public printReport(): void {
        if (!this.enabled) return

        console.group("📊 Resource Loading Performance Report")

        for (const [, phase] of this.phases) {
            this.printPhase(phase)
        }

        // ──── 전체 요약 ────
        const allResources = [...this.phases.values()].flatMap((p) => p.resources)
        const totalPhaseTime = [...this.phases.values()].reduce(
            (s, p) => s + p.duration,
            0,
        )
        const totalTransfer = allResources.reduce(
            (s, r) => s + Math.max(r.transferSize, 0),
            0,
        )
        const totalDecoded = allResources.reduce(
            (s, r) => s + Math.max(r.decodedBodySize, 0),
            0,
        )
        const totalDecode = allResources.reduce(
            (s, r) => s + Math.max(r.decodeDuration, 0),
            0,
        )

        console.log(
            [
                "",
                "═══ Overall Summary ═══",
                `  Resources  : ${allResources.length} (${allResources.filter((r) => r.cached).length} cached)`,
                `  Transfer   : ${formatBytes(totalTransfer)}`,
                `  Decoded    : ${formatBytes(totalDecoded)}`,
                `  Compression: ${totalDecoded > 0 ? ((1 - totalTransfer / totalDecoded) * 100).toFixed(1) : "N/A"}%`,
                `  Total Time : ${totalPhaseTime.toFixed(1)}ms`,
                `  Decode Time: ${totalDecode.toFixed(1)}ms (${totalPhaseTime > 0 ? ((totalDecode / totalPhaseTime) * 100).toFixed(1) : 0}% of total)`,
                "",
                "💡 Tip: Chrome DevTools → Performance 탭에서 'perf:' 마크를 검색하면 flame chart 에서 확인 가능합니다.",
            ].join("\n"),
        )

        console.groupEnd()
    }

    private printPhase(phase: PhaseMetric): void {
        const resources = phase.resources
        const totalTransfer = resources.reduce(
            (s, r) => s + Math.max(r.transferSize, 0),
            0,
        )
        const totalDecoded = resources.reduce(
            (s, r) => s + Math.max(r.decodedBodySize, 0),
            0,
        )
        const totalDecode = resources.reduce(
            (s, r) => s + Math.max(r.decodeDuration, 0),
            0,
        )
        const cachedCount = resources.filter((r) => r.cached).length

        console.group(
            `🔹 Phase: ${phase.name} (${phase.duration.toFixed(1)}ms)`,
        )

        console.log(
            [
                `  Resources     : ${resources.length} (${cachedCount} cached)`,
                `  Transfer Size : ${formatBytes(totalTransfer)}`,
                `  Decoded Size  : ${formatBytes(totalDecoded)}`,
                `  Compression   : ${totalDecoded > 0 ? ((1 - totalTransfer / totalDecoded) * 100).toFixed(1) : "N/A"}%`,
                `  Decode Overhead: ${totalDecode.toFixed(1)}ms (${phase.duration > 0 ? ((totalDecode / phase.duration) * 100).toFixed(1) : 0}% of phase)`,
            ].join("\n"),
        )

        // 타입별 요약
        const byType = new Map<string, ResourceMetric[]>()
        for (const r of resources) {
            const list = byType.get(r.type) ?? []
            list.push(r)
            byType.set(r.type, list)
        }

        console.group("📦 By Type")
        for (const [type, typeResources] of byType) {
            const typeTransfer = typeResources.reduce(
                (s, r) => s + Math.max(r.transferSize, 0),
                0,
            )
            const typeDecode = typeResources.reduce(
                (s, r) => s + Math.max(r.decodeDuration, 0),
                0,
            )
            const avgLoad =
                typeResources.reduce((s, r) => s + r.loadDuration, 0) /
                typeResources.length
            console.log(
                `  ${type}: ${typeResources.length}개 | transfer=${formatBytes(typeTransfer)} | avg_load=${avgLoad.toFixed(1)}ms | decode=${typeDecode.toFixed(1)}ms`,
            )
        }
        console.groupEnd()

        // 개별 리소스 테이블 (로드 시간 내림차순)
        const sorted = [...resources].sort(
            (a, b) => b.loadDuration - a.loadDuration,
        )
        console.table(
            sorted.map((r) => ({
                name: r.name,
                type: r.type,
                "load(ms)": +r.loadDuration.toFixed(1),
                "network(ms)":
                    r.networkDuration >= 0
                        ? +r.networkDuration.toFixed(1)
                        : "—",
                "decode(ms)":
                    r.decodeDuration >= 0 ? +r.decodeDuration.toFixed(1) : "—",
                "download(ms)":
                    r.downloadDuration >= 0
                        ? +r.downloadDuration.toFixed(1)
                        : "—",
                "ttfb(ms)": r.ttfb >= 0 ? +r.ttfb.toFixed(1) : "—",
                transfer:
                    r.transferSize >= 0 ? formatBytes(r.transferSize) : "—",
                decoded:
                    r.decodedBodySize >= 0
                        ? formatBytes(r.decodedBodySize)
                        : "—",
                cached: r.cached ? "✓" : "",
            })),
        )

        console.groupEnd()
    }

    // ──────────────────────────────────────────────
    // Raw data export (외부 분석용)
    // ──────────────────────────────────────────────

    public exportJSON(): string {
        const data = Object.fromEntries(
            [...this.phases.entries()].map(([key, phase]) => [key, phase]),
        )
        return JSON.stringify(data, null, 2)
    }

    public clear(): void {
        this.phases.clear()
        this.currentPhase = null

        for (const entry of performance.getEntriesByType("mark")) {
            if (entry.name.startsWith("perf:")) {
                performance.clearMarks(entry.name)
            }
        }
        for (const entry of performance.getEntriesByType("measure")) {
            if (entry.name.startsWith("perf:")) {
                performance.clearMeasures(entry.name)
            }
        }
    }
}

export const PerformanceTracker = new PerformanceTrackerStore()

function formatBytes(bytes: number): string {
    if (bytes < 0) return "—"
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`
}

import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { glob } from "glob"

function formatBytes(bytes: number, decimals: number = 2) {
    if (!+bytes) return "0 Bytes"
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

async function printCompressionStats(originalPath: string, newPath: string) {
    try {
        const originalStats = await fs.stat(originalPath)
        const newStats = await fs.stat(newPath)

        const saved = originalStats.size - newStats.size
        const percent = ((saved / originalStats.size) * 100).toFixed(1)
        const color = saved > 0 ? "\x1b[32m" : "\x1b[31m"
        const reset = "\x1b[0m"

        console.log(
            `  📊 Stats: ${formatBytes(originalStats.size)} → ${color}${formatBytes(newStats.size)} (-${percent}%)${reset}`,
        )
    } catch (_) {
        console.error(`  ⚠️ Stats Error: Unable to read file size.`)
    }
}

{
    const directory = path.join(
        path.dirname(path.join(fileURLToPath(import.meta.url), "..")),
        process.argv[2] || ".",
    )

    const files = await glob(`${directory}/**/*.glb`, {
        ignore: {
            ignored: (p) => {
                return /-(draco|ktx|compressed|temp)\.glb$/.test(p.name)
            },
        },
    })

    console.log(`\n📦 발견된 모델 파일: ${files.length}개`)

    const filesPromise = files.map(async (inputFile) => {
        const tempFile = inputFile.replace(".glb", "-temp.glb")
        const finalFile = inputFile.replace(".glb", "-compressed.glb")

        console.log(`\nProcessing Model: ${path.basename(inputFile)}`)

        const ktx2Command = spawn("gltf-transform", [
            "etc1s",
            inputFile,
            tempFile,
            "--quality",
            "255",
        ])

        await new Promise<void>((resolve) => {
            ktx2Command.on("close", async (code) => {
                if (code !== 0) {
                    console.error(`  ❌ Step 1 Failed`)
                    resolve()
                    return
                }

                const dracoCommand = spawn("gltf-transform", [
                    "draco",
                    tempFile,
                    finalFile,
                    "--method",
                    "edgebreaker",
                    "--quantization-volume",
                    "mesh",
                    "--quantize-position",
                    "12",
                    "--quantize-normal",
                    "6",
                    "--quantize-texcoord",
                    "6",
                    "--quantize-color",
                    "2",
                    "--quantize-generic",
                    "2",
                ])

                dracoCommand.on("close", async (code) => {
                    try {
                        await fs.unlink(tempFile)
                    } catch (_) {}
                    if (code === 0) {
                        await printCompressionStats(inputFile, finalFile)
                    }
                    resolve()
                })
            })
        })
    })

    await Promise.all(filesPromise)
}

{
    const directory = path.join(
        path.dirname(path.join(fileURLToPath(import.meta.url), "..")),
        process.argv[2] || ".",
    )
    const files = await glob(`${directory}/**/*.{exr,jpg,png}`, {
        ignore: "**/{ui,favicons,social}/**",
    })

    console.log(`\n🎨 발견된 텍스처 파일: ${files.length}개`)

    const defaultPreset =
        "--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf srgb --target_type RGB"

    const presets: [RegExp, string][] = [
        [
            /mountain_disp.png$/,
            "--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf linear --target_type R --swizzle r001",
        ],
        [
            /mountain_diff.jpg$/,
            "--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf srgb --target_type RGB",
        ],
        [
            /mountain_nor_gl.exr$/,
            "--nowarn --t2 --encode uastc --zcmp 10 --assign_oetf linear --target_type RGB",
        ],
        [
            /mountain_rough.exr$/,
            "--nowarn --t2 --encode uastc --zcmp 10 --assign_oetf linear --target_type RGB",
        ],
        [
            /stars.png$/,
            "--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf srgb --target_type RGB",
        ],
        [
            /rogland_clear_night_2k.hdr$/,
            "--t2 --encode uastc --uastc_hdr --assign_oetf linear --genmipmap",
        ],
    ]

    const filesPromise = files.map(async (inputFile) => {
        if (inputFile.endsWith(".ktx2")) {
            return
        }

        const normalizedInput = inputFile.split(path.sep).join("/")
        const preset = presets.find(([regex]) => regex.test(normalizedInput))

        const args = preset ? preset[1] : defaultPreset

        const parsePath = path.parse(inputFile)
        const outputFile = path.join(parsePath.dir, `${parsePath.name}.ktx2`)

        console.log(`\nCompressing: ${path.basename(inputFile)}`)

        let targetInputFile = inputFile
        let isTempFile = false

        if (inputFile.endsWith(".exr")) {
            try {
                const tempPng = path.join(
                    parsePath.dir,
                    `${parsePath.name}_temp.png`,
                )
                const convert = spawn("convert", [inputFile, tempPng])

                await new Promise<void>((resolve, reject) => {
                    convert.on("close", (code) => {
                        if (code === 0) resolve()
                        else
                            reject(
                                new Error(
                                    `ImageMagick exited with code ${code}`,
                                ),
                            )
                    })
                })

                targetInputFile = tempPng
                isTempFile = true
            } catch (err) {
                console.error(`  ❌ EXR conversion failed: ${err}`)
                return
            }
        }

        const toktx = spawn("toktx", [
            ...args.split(" "),
            outputFile,
            targetInputFile,
        ])
        toktx.stderr.on("data", (data) => console.error(`  toktx err: ${data}`))

        await new Promise<void>((resolve) =>
            toktx.on("close", async (code) => {
                if (code === 0) {
                    await printCompressionStats(inputFile, outputFile)
                }
                resolve()
            }),
        )

        if (isTempFile) {
            try {
                await fs.unlink(targetInputFile)
            } catch (err) {
                console.error(`❌ Temp file deletion failed: ${err}`)
            }
        }
    })

    await Promise.all(filesPromise)
}

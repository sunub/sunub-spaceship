import { Game } from "@/widgets/Game"

const main = async () => {
    const game = Game.getInstance()
    await game.init()
    game.start()
}

main().catch(console.error)

import "./style.css"
import { Game } from "./widgets/Game"

const main = async () => {
	const game = Game.getInstance()
	await game.initialize()
	game.start()
}

main().catch(console.error)

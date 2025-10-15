import "reflect-metadata";
import "./style.css";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/Addons.js";
import { Game } from "./widgets/Game";

const main = async () => {
  const game = Game.getInstance();
  await game.initialize();
  setupEnvironment(game);
  setupLights(game);
  game.start();
};

function setupEnvironment(game: Game) {
  new RGBELoader()
    .setPath("/texture/")
    .load("qwantani_night_puresky_4k.hdr", function (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      game.scene.environment = texture;
    });
}

function setupLights(game: Game) {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  
  game.scene.add(ambientLight);
  game.scene.add(directionalLight);
}

// 실행
main().catch(console.error);

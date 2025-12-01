import * as THREE from 'three';

export class EngineFlame {

  constructor(tick: number, scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xffa500, side: THREE.DoubleSide });

    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
  }
}

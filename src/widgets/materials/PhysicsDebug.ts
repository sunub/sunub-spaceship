import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { ServiceRegistry } from "../../core/ServiceRegistry";

export class PhysicsDebug {
  private _scene: THREE.Scene;
  private _world: RAPIER.World;

  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  lineSegments: THREE.LineSegments;

  constructor(physicWorld: RAPIER.World)
  {
    const registry = ServiceRegistry.getInstance();
    this._scene = registry.get<THREE.Scene>('scene');
    this._world = physicWorld;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute([], 4));

    this.material = new THREE.LineBasicMaterial({ vertexColors: true });
    this.lineSegments = new THREE.LineSegments(this.geometry, this.material);
    this._scene.add(this.lineSegments);
  }

  update()
  {
    const { vertices, colors } = this._world.debugRender();

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.attributes.position.needsUpdate = true;

    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    this.geometry.attributes.color.needsUpdate = true;

  }
}

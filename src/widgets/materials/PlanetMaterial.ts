// @ts-nocheck
import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../Shader/PlanetShader';

interface PlanetMaterialOptions {
  transparent?: boolean;
  uColorStop1?: THREE.Vector2;
  uColorStop2?: THREE.Vector2;
  uColor1?: [number, number, number];
  uColor2?: [number, number, number];
  uEmissionColor?: [number, number, number];
  uEmissionStrength?: number;
}

export class PlanetMaterial extends THREE.ShaderMaterial {
  constructor({
    transparent = true,
    uColorStop1 = new THREE.Vector2(0.2, 0.8),
    uColorStop2 = new THREE.Vector2(0.3, 0.7),
    uColor1 = [1, 0.5, 0],
    uColor2 = [0, 0, 1],
    uEmissionColor = [1, 0, 1],
    uEmissionStrength = 0.7,
  }: PlanetMaterialOptions = {}) {
    super({
      uniforms: {
        uTime: { value: 0 },
        uColorStop1: { value: uColorStop1 },
        uColorStop2: { value: uColorStop2 },
        uColor1: { value: new THREE.Color(...uColor1) },
        uColor2: { value: new THREE.Color(...uColor2) },
        uEmissionColor: { value: new THREE.Color(...uEmissionColor) },
        uEmissionStrength: { value: uEmissionStrength },
      },
      vertexShader,
      fragmentShader,
      transparent,
    });
  }

  get uTime(): number {
    return this.uniforms.uTime.value;
  }

  set uTime(value: number) {
    this.uniforms.uTime.value = value;
  }
}
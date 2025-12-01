
// @ts-nocheck
import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../Shader/LandShader';

interface LandMaterialOptions {
  side?: THREE.Side;
  uLightPosition?: THREE.Vector3;
  uDarkColor?: THREE.Color;
  uLightColor?: THREE.Color;
  uLightIntensity?: number;
  uLightRadius?: number;
}

export class LandMaterial extends THREE.ShaderMaterial {
  constructor({
    side = THREE.FrontSide,
    uLightPosition = new THREE.Vector3(0, 0, 0),
    uDarkColor = new THREE.Color('#07002d'),
    uLightColor = new THREE.Color('#bca29f'),
    uLightIntensity = 1.5,
    uLightRadius = 4.45,
  }: LandMaterialOptions = {}) {
    super({
      uniforms: {
        uTime: { value: 0 },
        uLightPosition: { value: uLightPosition },
        uDarkColor: { value: uDarkColor },
        uLightColor: { value: uLightColor },
        uLightIntensity: { value: uLightIntensity },
        uLightRadius: { value: uLightRadius },
      },
      vertexShader,
      fragmentShader,
      side,
      transparent: true,
    });
  }

  get uTime(): number {
    return this.uniforms.uTime.value;
  }

  set uTime(value: number) {
    this.uniforms.uTime.value = value;
  }
}

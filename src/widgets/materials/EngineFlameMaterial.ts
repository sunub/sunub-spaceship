
// @ts-nocheck
// src/widgets/materials/EngineFlameMaterial.ts

import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../Shader/EngineFlameShader';

export class EngineFlameMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        u_time: { value: 0 },
        u_fuel: { value: 0.0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false, // 투명한 객체는 보통 depth buffer에 쓰지 않음
      blending: THREE.AdditiveBlending, // 불꽃처럼 빛나는 효과를 위한 블렌딩 모드
      side: THREE.DoubleSide,
    });
  }

  // u_time 업데이트용 getter/setter
  get u_time(): number {
    return this.uniforms.u_time.value;
  }

  set u_time(value: number) {
    this.uniforms.u_time.value = value;
  }

  // u_fuel 업데이트용 getter/setter
  get u_fuel(): number {
    return this.uniforms.u_fuel.value;
  }

  set u_fuel(value: number) {
    this.uniforms.u_fuel.value = value;
  }
}

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import EventEmitter from "./EventEmitter";

interface Source {
  name: string;
  type: string;
  path: string | string[];
}

interface Loaders {
  gltfLoader?: GLTFLoader;
  dracoLoader?: DRACOLoader;
  textureLoader?: THREE.TextureLoader;
  cubeTextureLoader?: THREE.CubeTextureLoader;
}

interface Items {
  [key: string]: any;
}

export default class Resources extends EventEmitter {
  sources: Source[];
  loaders!: Loaders;
  items: Items;
  toLoad: number;
  loaded: number;

  constructor(sources: Source[]) {
    super();
    this.sources = sources;

    this.items = {};
    this.toLoad = this.sources.length;
    this.loaded = 0;

    this.setLoaders();
    this.startLoading();
  }

  setLoaders() {
    this.loaders = {};
    
    // GLTF 로더 설정
    this.loaders.gltfLoader = new GLTFLoader();
    this.loaders.dracoLoader = new DRACOLoader();
    this.loaders.dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/v1/decoders/"
    );
    this.loaders.gltfLoader.setDRACOLoader(this.loaders.dracoLoader);
    
    // 텍스처 로더들 설정
    this.loaders.textureLoader = new THREE.TextureLoader();
    this.loaders.cubeTextureLoader = new THREE.CubeTextureLoader();
  }

  startLoading() {
    for (const source of this.sources) {
      switch (source.type) {
        case "gltfModel":
          this.loadGltfSource(source);
          break;
        case "texture":
          this.loadTextureSource(source);
          break;
        case "cubeTexture":
          this.loadCubeTextureSource(source);
          break;
        default:
          console.warn(`Unknown source type: ${source.type}`);
      }
    }
  }

  loadGltfSource(source: Source) {
    if (!this.loaders.gltfLoader) {
      this.setLoaders();
    }
    this.loaders.gltfLoader?.load(source.path as string, (file) => {
      this.sourceLoaded(source, file);
    });
  }

  loadTextureSource(source: Source) {
    if (!this.loaders.textureLoader) {
      this.setLoaders();
    }
    this.loaders.textureLoader?.load(
      source.path as string,
      (texture) => {
        this.sourceLoaded(source, texture);
      },
      undefined,
      (error) => {
        console.error(`Failed to load texture: ${source.name}`, error);
      }
    );
  }

  loadCubeTextureSource(source: Source) {
    if (!this.loaders.cubeTextureLoader) {
      this.setLoaders();
    }
    this.loaders.cubeTextureLoader?.load(
      source.path as string[],
      (texture) => {
        this.sourceLoaded(source, texture);
      },
      undefined,
      (error) => {
        console.error(`Failed to load cube texture: ${source.name}`, error);
      }
    );
  }

  sourceLoaded<T>(source: Source, file: T) {
    this.items[source.name] = file;
    this.loaded++;

    if (this.loaded === this.toLoad) {
      this.trigger("ready");
    }
  }

  // 모델 접근을 위한 헬퍼 메서드들
  getModel(name: string): THREE.Group | null {
    const item = this.items[name];
    return item?.scene || null;
  }

  getTexture(name: string): THREE.Texture | null {
    return this.items[name] || null;
  }

  hasResource(name: string): boolean {
    return this.items.hasOwnProperty(name);
  }

  // 리소스가 로드될 때까지 대기하는 Promise 메서드
  waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.loaded === this.toLoad) {
        resolve();
      } else {
        this.on('ready', () => resolve());
      }
    });
  }
}

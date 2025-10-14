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
    this.loaders.gltfLoader = new GLTFLoader();
    this.loaders.dracoLoader = new DRACOLoader();
    this.loaders.dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/v1/decoders/"
    );
    this.loaders.gltfLoader.setDRACOLoader(this.loaders.dracoLoader);
  }

  startLoading() {
    for (const source of this.sources) {
      switch (source.type) {
        case "gltfModel":
          this.loadGltfSource(source);
          break;
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

  sourceLoaded<T>(source: Source, file: T) {
    this.items[source.name] = file;
    this.loaded++;

    if (this.loaded === this.toLoad) {
      this.trigger("ready");
    }
  }
}

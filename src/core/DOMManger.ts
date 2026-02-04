import { injectable } from "inversify";

@injectable()
export class DOMManager {
    public domElement!: HTMLDivElement;
    public canvasElement!: HTMLCanvasElement;

    constructor() {
        this.domElement = document.querySelector(".root") as HTMLDivElement;
        this.canvasElement = this.domElement.querySelector(".canvas") as HTMLCanvasElement;
        
        if (!this.canvasElement) {
            console.error("Canvas element not found!");
        } else {
            this.canvasElement.tabIndex = 0
            this.canvasElement.style.outline = "none"
            this.canvasElement.focus()
        }
    }
    
    get canvas() { 
      return this.canvasElement; 
    }
}
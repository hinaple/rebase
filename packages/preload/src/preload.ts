const AssetTypes = <const>["image", "video", "audio"];
type AssetType = (typeof AssetTypes)[number];

type PreloadData =
    | {
          type: "image";
          dom: HTMLImageElement;
          src: string;
      }
    | {
          type: "video";
          dom: HTMLVideoElement;
          src: string;
      }
    | {
          type: "audio";
          audio: HTMLAudioElement;
          src: string;
      };

const FileTypes: Record<AssetType, string[]> = {
    image: ["jpg", "jpeg", "gif", "svg", "webp", "png", "bmp", "ico"],
    video: ["mp4", "webm", "mkv"],
    audio: ["mp3", "wav", "ogg", "m4a", "weba"],
} as const;
const FileTypeMap: Map<string, AssetType> = new Map();
Object.entries(FileTypes).forEach(([type, exts]) => {
    exts.forEach((e) => FileTypeMap.set(e, type as AssetType));
});

function getExtension(src: string) {
    return src.split(".").pop()?.toLowerCase() ?? null;
}
function getFileType(src: string) {
    const ext = getExtension(src);
    return ext ? (FileTypeMap.get(ext) ?? null) : null;
}

export default class Preloader {
    private preloads: Map<string, PreloadData> = new Map();
    private parent: HTMLElement;
    private container: HTMLDivElement;

    constructor(parent: HTMLElement = document.body) {
        this.parent = parent;
        this.container = document.createElement("div");
        this.container.classList.add("preload-container");
        this.parent.append(this.container);
    }

    load(src: string, type?: AssetType | null) {
        if (this.preloads.has(src)) return this.preloads.get(src);

        if (!type) type = getFileType(src);
        if (!type || !AssetTypes.includes(type))
            throw new Error(`${type} is unknown type.`);

        const data: any = { src, type };
        if (type === "audio") {
            let audio = new Audio(src);
            audio.load();
            data.audio = audio;
        } else if (type === "video") {
            let dom = document.createElement("video");
            dom.src = src;
            dom.autoplay = false;
            this.appendToDom(dom);
            data.dom = dom;
        } else if (type === "image") {
            let dom = document.createElement("img");
            dom.src = src;
            this.appendToDom(dom);
            data.dom = dom;
        }

        this.preloads.set(src, data);
        return data;
    }

    private appendToDom(dom: HTMLElement) {
        this.container.append(dom);
    }
}

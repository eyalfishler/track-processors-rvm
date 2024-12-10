import * as vision from '@mediapipe/tasks-vision';
import VideoTransformer from './VideoTransformer';
import { VideoTransformerInitOptions } from './types';
export type RVMSegmenterOptions = Partial<vision.ImageSegmenterOptions['baseOptions']>;
export type RVMBackgroundOptions = {
    blurRadius?: number;
    imagePath?: string;
    /** cannot be updated through the `update` method, needs a restart */
    segmenterOptions?: RVMSegmenterOptions;
    /** cannot be updated through the `update` method, needs a restart */
    assetPaths?: {
        tasksVisionFileSet?: string;
        modelAssetPath?: string;
    };
};
export default class RVMBackgroundProcessor extends VideoTransformer<RVMBackgroundOptions> {
    static get isSupported(): boolean;
    imageSegmenter?: vision.ImageSegmenter;
    segmentationResults: vision.ImageSegmenterResult | undefined;
    backgroundImage: ImageBitmap | null;
    blurRadius?: number;
    options: RVMBackgroundOptions;
    tempCanvas: HTMLCanvasElement;
    constructor(opts: RVMBackgroundOptions);
    init({ outputCanvas, inputElement: inputVideo }: VideoTransformerInitOptions): Promise<void>;
    destroy(): Promise<void>;
    loadBackground(path: string): Promise<void>;
    transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>): Promise<void>;
    update(opts: RVMBackgroundOptions): Promise<void>;
    drawVirtualBackground(frame: VideoFrame): Promise<void>;
    blurBackground(frame: VideoFrame): Promise<void>;
}

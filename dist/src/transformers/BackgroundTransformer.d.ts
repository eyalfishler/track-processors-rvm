import * as vision from '@mediapipe/tasks-vision';
import VideoTransformer from './VideoTransformer';
import { VideoTransformerInitOptions } from './types';
export type SegmenterOptions = Partial<vision.ImageSegmenterOptions['baseOptions']>;
export type BackgroundOptions = {
    blurRadius?: number;
    imagePath?: string;
    /** cannot be updated through the `update` method, needs a restart */
    segmenterOptions?: SegmenterOptions;
    /** cannot be updated through the `update` method, needs a restart */
    assetPaths?: {
        tasksVisionFileSet?: string;
        modelAssetPath?: string;
    };
};
export default class BackgroundProcessor extends VideoTransformer<BackgroundOptions> {
    static get isSupported(): boolean;
    imageSegmenter?: vision.ImageSegmenter;
    segmentationResults: vision.ImageSegmenterResult | undefined;
    backgroundImage: ImageBitmap | null;
    blurRadius?: number;
    options: BackgroundOptions;
    constructor(opts: BackgroundOptions);
    init({ outputCanvas, inputElement: inputVideo }: VideoTransformerInitOptions): Promise<void>;
    destroy(): Promise<void>;
    loadBackground(path: string): Promise<void>;
    transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>): Promise<void>;
    update(opts: BackgroundOptions): Promise<void>;
    drawVirtualBackground(frame: VideoFrame): Promise<void>;
    blurBackground(frame: VideoFrame): Promise<void>;
}

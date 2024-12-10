import { VideoTrackTransformer, VideoTransformerInitOptions } from './types';
export default abstract class VideoTransformer<Options extends Record<string, unknown>> implements VideoTrackTransformer<Options> {
    transformer?: TransformStream;
    canvas?: OffscreenCanvas;
    ctx?: OffscreenCanvasRenderingContext2D;
    inputVideo?: HTMLVideoElement;
    protected isDisabled?: Boolean;
    init({ outputCanvas, inputElement: inputVideo, }: VideoTransformerInitOptions): Promise<void>;
    restart({ outputCanvas, inputElement: inputVideo }: VideoTransformerInitOptions): Promise<void>;
    destroy(): Promise<void>;
    abstract transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>): void;
    abstract update(options: Options): void;
}

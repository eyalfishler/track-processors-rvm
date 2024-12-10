import { Holistic, Options, Results } from '@mediapipe/holistic';
import VideoTransformer from './VideoTransformer';
import { VideoTransformerInitOptions } from './types';
export type MediaPipeHolisticTrackerTransformerOptions = {
    holisticOptions?: Options;
    callback?: (results: Results) => void;
};
export default class MediaPipeHolisticTrackerTransformer extends VideoTransformer<MediaPipeHolisticTrackerTransformerOptions> {
    holistic?: Holistic;
    holisticOptions: Options;
    callback: (results: Results) => void;
    static get isSupported(): boolean;
    constructor({ holisticOptions, callback }: MediaPipeHolisticTrackerTransformerOptions);
    init({ inputElement: inputVideo, outputCanvas, }: VideoTransformerInitOptions): Promise<void>;
    destroy(): Promise<void>;
    update(): Promise<void>;
    transform(): Promise<void>;
    sendFramesContinuouslyForTracking(videoEl: HTMLVideoElement): Promise<void>;
}

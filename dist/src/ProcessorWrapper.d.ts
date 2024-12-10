import type { ProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import { TrackTransformer } from './transformers';
export default class ProcessorWrapper<TransformerOptions extends Record<string, unknown>> implements TrackProcessor<Track.Kind> {
    static get isSupported(): boolean;
    name: string;
    source?: MediaStreamVideoTrack;
    sourceSettings?: MediaTrackSettings;
    processor?: MediaStreamTrackProcessor<VideoFrame>;
    trackGenerator?: MediaStreamTrackGenerator<VideoFrame>;
    canvas?: OffscreenCanvas;
    sourceDummy?: HTMLMediaElement;
    processedTrack?: MediaStreamTrack;
    transformer: TrackTransformer<TransformerOptions>;
    constructor(transformer: TrackTransformer<TransformerOptions>, name: string);
    private setup;
    init(opts: ProcessorOptions<Track.Kind>): Promise<void>;
    restart(opts: ProcessorOptions<Track.Kind>): Promise<void>;
    restartTransformer(...options: Parameters<(typeof this.transformer)['restart']>): Promise<void>;
    updateTransformerOptions(...options: Parameters<(typeof this.transformer)['update']>): Promise<void>;
    destroy(): Promise<void>;
}

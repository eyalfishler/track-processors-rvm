import * as vision from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';
import * as rvm from './rvm';


const segmentationConfig: rvm.SegmentationConfig = {
    modelPath: './rvm.json',
    ratio: 0.3,
    mode: 'default',
};
const log = (...msg: any[]) => console.log(...msg); // eslint-disable-line no-console

//import { dependencies } from '../../package.json';
import VideoTransformer from './VideoTransformer';
import { VideoTransformerInitOptions } from './types';

export type RVMSegmenterOptions = Partial<vision.ImageSegmenterOptions['baseOptions']>;

export type RVMBackgroundOptions = {
    blurRadius?: number;
    imagePath?: string;
    /** cannot be updated through the `update` method, needs a restart */
    segmenterOptions?: RVMSegmenterOptions;
    /** cannot be updated through the `update` method, needs a restart */
    assetPaths?: { tasksVisionFileSet?: string; modelAssetPath?: string };
};

export default class RVMBackgroundProcessor extends VideoTransformer<RVMBackgroundOptions> {
    static get isSupported() {
        return typeof OffscreenCanvas !== 'undefined';
    }

    imageSegmenter?: vision.ImageSegmenter;

    segmentationResults: vision.ImageSegmenterResult | undefined;

    backgroundImage: ImageBitmap | null = null;

    blurRadius?: number;

    options: RVMBackgroundOptions;

    tempCanvas: HTMLCanvasElement;

    constructor(opts: RVMBackgroundOptions) {
        super();
        this.options = opts;
        this.update(opts);
        this.tempCanvas = document.createElement('canvas');
    }


    async init({ outputCanvas, inputElement: inputVideo }: VideoTransformerInitOptions) {
        await super.init({ outputCanvas, inputElement: inputVideo });
        this.tempCanvas.width = outputCanvas.width;
        this.tempCanvas.height = outputCanvas.height;
        await tf.setBackend('webgl');
        await tf.ready();
        tf.env().set('WEBGL_USE_SHAPES_UNIFORMS', true); // better tfjs performance when using webgl backend
        await rvm.load(segmentationConfig);
        log({ segmentationConfig });
        log({ tf: tf.version_core, backend: tf.getBackend(), state: tf.engine().state });
        //const numTensors = tf.engine().state.numTensors;


        // const fileSet = await vision.FilesetResolver.forVisionTasks(
        //     this.options.assetPaths?.tasksVisionFileSet ??
        //     `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`,
        // );

        // this.imageSegmenter = await vision.ImageSegmenter.createFromOptions(fileSet, {
        //     baseOptions: {
        //         modelAssetPath:
        //             this.options.assetPaths?.modelAssetPath ??
        //             // 'https://storage.googleapis.com/mediapipe-tasks/image_segmenter/selfie_segmentation.tflite',
        //             'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        //         delegate: 'GPU',
        //         ...this.options.segmenterOptions,
        //     },
        //     runningMode: 'VIDEO',
        //     outputCategoryMask: true,
        //     outputConfidenceMasks: false,
        // });

        // Skip loading the image here if update already loaded the image below
        if (this.options?.imagePath && !this.backgroundImage) {
            await this.loadBackground(this.options.imagePath).catch((err) => console.error("Error while loading processor background image: ", err));
        }
    }

    async destroy() {
        await super.destroy();
        //await this.imageSegmenter?.close();
        this.backgroundImage = null;
    }

    async loadBackground(path: string) {
        const img = new Image();

        await new Promise((resolve, reject) => {
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = path;
        });
        const imageData = await createImageBitmap(img);
        this.backgroundImage = imageData;
    }

    async transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>) {
        try {
            if (this.isDisabled) {
                controller.enqueue(frame);
                return;
            }
            if (!this.canvas) {
                throw TypeError('Canvas needs to be initialized first');
            }
            const imageBitmap = await createImageBitmap(frame);
            const imageTensor = tf.browser.fromPixels(imageBitmap);
            segmentationConfig.mode = "default";// get segmentation mode from ui
            segmentationConfig.ratio = 0.5; // get segmentation downsample ratio from ui
            const rgba = await rvm.predict(imageTensor as tf.Tensor3D, segmentationConfig);
            tf.browser.toPixels(rgba, this.tempCanvas); // draw raw output
            //const ctx = this.canvas.getContext('2d');
            if (this.ctx) {
                const imageBitmap = await createImageBitmap(this.tempCanvas);
                if (this.backgroundImage) {
                    this.ctx.drawImage(
                        this.backgroundImage,
                        0,
                        0,
                        this.backgroundImage.width,
                        this.backgroundImage.height,
                        0,
                        0,
                        this.canvas.width,
                        this.canvas.height,
                    );
                }
                this.ctx.drawImage(imageBitmap, 0, 0);
            }
            tf.dispose([imageTensor, rgba]); // dispose tensors
            //let startTimeMs = performance.now();
            // this.imageSegmenter?.segmentForVideo(
            //     this.inputVideo!,
            //     startTimeMs,
            //     (result) => (this.segmentationResults = result),
            // );

            // if (this.blurRadius) {
            //     await this.blurBackground(frame);
            // } else {
            //     await this.drawVirtualBackground(frame);
            // }
            const newFrame = new VideoFrame(this.canvas, {
                timestamp: frame.timestamp || Date.now(),
            });
            controller.enqueue(newFrame);
        } finally {
            frame.close();
        }
    }

    async update(opts: RVMBackgroundOptions) {
        this.options = opts;
        if (opts.blurRadius) {
            this.blurRadius = opts.blurRadius;
        } else if (opts.imagePath) {
            await this.loadBackground(opts.imagePath);
        }
    }

    async drawVirtualBackground(frame: VideoFrame) {
        //if (!this.canvas || !this.ctx || !this.segmentationResults || !this.inputVideo) return;
        if (!this.canvas || !this.ctx) return;
        // this.ctx.save();
        // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // if (this.segmentationResults?.categoryMask) {
        //     this.ctx.filter = 'blur(10px)';
        //     this.ctx.globalCompositeOperation = 'copy';
        //     const bitmap = await maskToBitmap(
        //         this.segmentationResults.categoryMask,
        //         this.segmentationResults.categoryMask.width,
        //         this.segmentationResults.categoryMask.height,
        //     );
        //     this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
        //     this.ctx.filter = 'none';
        //     this.ctx.globalCompositeOperation = 'source-in';
        //     if (this.backgroundImage) {
        //         this.ctx.drawImage(
        //             this.backgroundImage,
        //             0,
        //             0,
        //             this.backgroundImage.width,
        //             this.backgroundImage.height,
        //             0,
        //             0,
        //             this.canvas.width,
        //             this.canvas.height,
        //         );
        //     } else {
        //         this.ctx.fillStyle = '#00FF00';
        //         this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        //     }

        //     this.ctx.globalCompositeOperation = 'destination-over';
        // }
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
        // this.ctx.restore();
    }

    async blurBackground(frame: VideoFrame) {
        if (
            !this.ctx ||
            !this.canvas ||
            !this.segmentationResults?.categoryMask?.canvas ||
            !this.inputVideo
        ) {
            return;
        }

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'copy';

        const bitmap = await maskToBitmap(
            this.segmentationResults.categoryMask,
            this.segmentationResults.categoryMask.width,
            this.segmentationResults.categoryMask.height,
        );

        this.ctx.filter = 'blur(3px)';
        this.ctx.globalCompositeOperation = 'copy';
        this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.filter = 'none';
        this.ctx.globalCompositeOperation = 'source-out';
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'destination-over';
        this.ctx.filter = `blur(${this.blurRadius}px)`;
        this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }
}

function maskToBitmap(
    mask: vision.MPMask,
    videoWidth: number,
    videoHeight: number,
): Promise<ImageBitmap> {
    const dataArray: Uint8ClampedArray = new Uint8ClampedArray(videoWidth * videoHeight * 4);
    const result = mask.getAsUint8Array();
    for (let i = 0; i < result.length; i += 1) {
        dataArray[i * 4] = result[i];
        dataArray[i * 4 + 1] = result[i];
        dataArray[i * 4 + 2] = result[i];
        dataArray[i * 4 + 3] = result[i];
    }
    const dataNew = new ImageData(dataArray, videoWidth, videoHeight);

    return createImageBitmap(dataNew);
}

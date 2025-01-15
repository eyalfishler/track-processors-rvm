import * as vision from '@mediapipe/tasks-vision';

//import { dependencies } from '../../package.json';
import VideoTransformer from './VideoTransformer';
import { VideoTransformerInitOptions } from './types';

export type SegmenterOptions = Partial<vision.ImageSegmenterOptions['baseOptions']>;

export type BackgroundOptions = {
  blurRadius?: number;
  imagePath?: string;
  /** cannot be updated through the `update` method, needs a restart */
  segmenterOptions?: SegmenterOptions;
  /** cannot be updated through the `update` method, needs a restart */
  assetPaths?: { tasksVisionFileSet?: string; modelAssetPath?: string };
};

export default class BackgroundProcessor extends VideoTransformer<BackgroundOptions> {
  static get isSupported() {
    return typeof OffscreenCanvas !== 'undefined';
  }

  imageSegmenter?: vision.ImageSegmenter;

  segmentationResults: vision.ImageSegmenterResult | undefined;

  backgroundImage: ImageBitmap | null = null;

  blurRadius?: number;

  options: BackgroundOptions;

  constructor(opts: BackgroundOptions) {
    super();
    this.options = opts;
    this.update(opts);
  }

  async init({ outputCanvas, inputElement: inputVideo }: VideoTransformerInitOptions) {
    await super.init({ outputCanvas, inputElement: inputVideo });

    const fileSet = await vision.FilesetResolver.forVisionTasks(
      this.options.assetPaths?.tasksVisionFileSet ??
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`,
    );

    this.imageSegmenter = await vision.ImageSegmenter.createFromOptions(fileSet, {
      baseOptions: {
        modelAssetPath:
          this.options.assetPaths?.modelAssetPath ??
          'https://storage.googleapis.com/mediapipe-tasks/image_segmenter/selfie_segmentation.tflite',
        //"https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
        // 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
        //'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite?v=aljali.mediapipestudio_20230621_1811_RC00',
        //'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        delegate: 'GPU',
        ...this.options.segmenterOptions,
      },
      runningMode: 'VIDEO',
      //outputconfidenceMasks: false,
      outputConfidenceMasks: true,

      outputCategoryMask: false,
      //outputConfidenceMasks: true,
    });



    // Skip loading the image here if update already loaded the image below
    if (this.options?.imagePath && !this.backgroundImage) {
      await this.loadBackground(this.options.imagePath).catch((err) => console.error("Error while loading processor background image: ", err));
    }
  }

  async destroy() {
    await super.destroy();
    await this.imageSegmenter?.close();
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
      let startTimeMs = performance.now();
      this.imageSegmenter?.segmentForVideo(
        this.inputVideo!,
        startTimeMs,
        (result) => (this.segmentationResults = result),
      );

      if (this.blurRadius) {
        await this.blurBackground(frame);
      } else {
        await this.drawVirtualBackground2(frame);
      }
      const newFrame = new VideoFrame(this.canvas, {
        timestamp: frame.timestamp || Date.now(),
      });
      controller.enqueue(newFrame);
    } finally {
      frame.close();
    }
  }

  async update(opts: BackgroundOptions) {
    this.options = opts;
    if (opts.blurRadius) {
      this.blurRadius = opts.blurRadius;
    } else if (opts.imagePath) {
      await this.loadBackground(opts.imagePath);
    }
  }



  async drawVirtualBackground2(frame: VideoFrame) {
    if (!this.canvas || !this.ctx || !this.segmentationResults || !this.inputVideo) return;
    // this.ctx.save();
    // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.segmentationResults?.categoryMask) {
      this.ctx.filter = 'blur(4px)';
      this.ctx.globalCompositeOperation = 'destination-atop';
      const bitmap = await maskToBitmap(
        this.segmentationResults.categoryMask,
        this.segmentationResults.categoryMask.width,
        this.segmentationResults.categoryMask.height,
      );
      this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.filter = 'none';
      this.ctx.globalCompositeOperation = 'source-in';
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
      } else {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }

      this.ctx.globalCompositeOperation = 'destination-over';
    }
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    // this.ctx.restore();
  }


  async drawVirtualBackground(frame: VideoFrame) {
    if (!this.canvas || !this.ctx || !this.segmentationResults || !this.inputVideo) return;
    // console.log("drawVirtualBackground");
    // this.ctx.save();
    // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.segmentationResults?.confidenceMasks) {
      this.ctx.filter = 'blur(2px)';
      this.ctx.globalCompositeOperation = 'destination-atop';
      const mask = this.segmentationResults?.confidenceMasks[0];
      if (mask && mask.height == 0) {
        //console.log("mask.height == 0");
        return;
      }
      const bitmap = await maskToBitmap(mask, mask.width, mask.height);

      // const bitmap = await maskToBitmap(
      //   this.segmentationResults.confidenceMasks[0],
      //   this.segmentationResults.confidenceMasks[0].width,
      //   this.segmentationResults.confidenceMasks[0].height,
      // );
      this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.filter = 'none';
      this.ctx.globalCompositeOperation = 'source-in';
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
      } else {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }

      this.ctx.globalCompositeOperation = 'destination-over';
    }
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

    this.ctx.filter = 'blur(0px)';
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

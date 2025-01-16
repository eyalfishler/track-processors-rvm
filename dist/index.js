"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } }var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/ProcessorWrapper.ts
var ProcessorWrapper = class {
  static get isSupported() {
    return typeof MediaStreamTrackGenerator !== "undefined" && typeof MediaStreamTrackProcessor !== "undefined";
  }
  constructor(transformer, name) {
    this.name = name;
    this.transformer = transformer;
    this.transformer.restart;
  }
  async setup(opts) {
    var _a, _b, _c, _d;
    this.source = opts.track;
    const origConstraints = this.source.getConstraints();
    await this.source.applyConstraints(__spreadProps(__spreadValues({}, origConstraints), {
      // @ts-expect-error when a mediastream track is resized and/or cropped, the `VideoFrame` will have a coded height/width of the original video size
      // this leads to a shift of the underlying video as the frame itself is being rendered with the coded size
      // but image segmentation is based on the display dimensions (-> the cropped version)
      // in order to prevent this, we force the resize mode to "none"
      resizeMode: "none"
    }));
    this.sourceSettings = this.source.getSettings();
    this.sourceDummy = opts.element;
    if (this.sourceDummy instanceof HTMLVideoElement) {
      this.sourceDummy.height = (_a = this.sourceSettings.height) != null ? _a : 300;
      this.sourceDummy.width = (_b = this.sourceSettings.width) != null ? _b : 300;
    }
    if (!(this.sourceDummy instanceof HTMLVideoElement)) {
      throw TypeError("Currently only video transformers are supported");
    }
    this.processor = new MediaStreamTrackProcessor({ track: this.source });
    this.trackGenerator = new MediaStreamTrackGenerator({
      kind: "video",
      signalTarget: this.source
    });
    this.canvas = new OffscreenCanvas(
      (_c = this.sourceSettings.width) != null ? _c : 300,
      (_d = this.sourceSettings.height) != null ? _d : 300
    );
  }
  async init(opts) {
    await this.setup(opts);
    if (!this.canvas || !this.processor || !this.trackGenerator) {
      throw new TypeError("Expected both canvas and processor to be defined after setup");
    }
    let readableStream = this.processor.readable;
    await this.transformer.init({
      outputCanvas: this.canvas,
      inputElement: this.sourceDummy
    });
    readableStream = readableStream.pipeThrough(this.transformer.transformer);
    readableStream.pipeTo(this.trackGenerator.writable).catch((e) => console.error("error when trying to pipe", e)).finally(() => this.destroy());
    this.processedTrack = this.trackGenerator;
  }
  async restart(opts) {
    await this.destroy();
    return this.init(opts);
  }
  async restartTransformer(...options) {
    this.transformer.restart(options[0]);
  }
  async updateTransformerOptions(...options) {
    this.transformer.update(options[0]);
  }
  async destroy() {
    var _a;
    await this.transformer.destroy();
    (_a = this.trackGenerator) == null ? void 0 : _a.stop();
  }
};

// src/transformers/BackgroundTransformer.ts
var _tasksvision = require('@mediapipe/tasks-vision'); var vision = _interopRequireWildcard(_tasksvision);

// src/transformers/VideoTransformer.ts
var VideoTransformer = class {
  constructor() {
    this.isDisabled = false;
  }
  async init({
    outputCanvas,
    inputElement: inputVideo
  }) {
    var _a;
    if (!(inputVideo instanceof HTMLVideoElement)) {
      throw TypeError("Video transformer needs a HTMLVideoElement as input");
    }
    this.transformer = new TransformStream({
      transform: (frame, controller) => this.transform(frame, controller)
    });
    this.canvas = outputCanvas || null;
    if (outputCanvas) {
      this.ctx = ((_a = this.canvas) == null ? void 0 : _a.getContext("2d")) || void 0;
    }
    this.inputVideo = inputVideo;
    this.isDisabled = false;
  }
  async restart({ outputCanvas, inputElement: inputVideo }) {
    this.canvas = outputCanvas || null;
    this.ctx = this.canvas.getContext("2d") || void 0;
    this.inputVideo = inputVideo;
    this.isDisabled = false;
  }
  async destroy() {
    this.isDisabled = true;
    this.canvas = void 0;
    this.ctx = void 0;
  }
};

// src/transformers/BackgroundTransformer.ts
var BackgroundProcessor = class extends VideoTransformer {
  constructor(opts) {
    super();
    this.backgroundImage = null;
    this.options = opts;
    this.update(opts);
  }
  static get isSupported() {
    return typeof OffscreenCanvas !== "undefined";
  }
  async init({ outputCanvas, inputElement: inputVideo }) {
    var _a, _b, _c, _d, _e;
    await super.init({ outputCanvas, inputElement: inputVideo });
    const fileSet = await vision.FilesetResolver.forVisionTasks(
      (_b = (_a = this.options.assetPaths) == null ? void 0 : _a.tasksVisionFileSet) != null ? _b : `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`
    );
    this.imageSegmenter = await vision.ImageSegmenter.createFromOptions(fileSet, {
      baseOptions: __spreadValues({
        modelAssetPath: (_d = (_c = this.options.assetPaths) == null ? void 0 : _c.modelAssetPath) != null ? _d : (
          // 'https://storage.googleapis.com/mediapipe-tasks/image_segmenter/selfie_segmentation.tflite',
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite"
        ),
        // 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
        //'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite?v=aljali.mediapipestudio_20230621_1811_RC00',
        //'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        delegate: "CPU"
      }, this.options.segmenterOptions),
      runningMode: "VIDEO",
      //outputconfidenceMasks: false,
      outputConfidenceMasks: true,
      outputCategoryMask: false
      //outputConfidenceMasks: true,
    });
    if (((_e = this.options) == null ? void 0 : _e.imagePath) && !this.backgroundImage) {
      await this.loadBackground(this.options.imagePath).catch((err) => console.error("Error while loading processor background image: ", err));
    }
  }
  async destroy() {
    var _a;
    await super.destroy();
    await ((_a = this.imageSegmenter) == null ? void 0 : _a.close());
    this.backgroundImage = null;
  }
  async loadBackground(path) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = path;
    });
    const imageData = await createImageBitmap(img);
    this.backgroundImage = imageData;
  }
  async transform(frame, controller) {
    var _a;
    try {
      if (this.isDisabled) {
        controller.enqueue(frame);
        return;
      }
      if (!this.canvas) {
        throw TypeError("Canvas needs to be initialized first");
      }
      let startTimeMs = performance.now();
      (_a = this.imageSegmenter) == null ? void 0 : _a.segmentForVideo(
        this.inputVideo,
        startTimeMs,
        (result) => this.segmentationResults = result
      );
      if (this.blurRadius) {
        await this.blurBackground(frame);
      } else {
        await this.drawVirtualBackground(frame);
      }
      const newFrame = new VideoFrame(this.canvas, {
        timestamp: frame.timestamp || Date.now()
      });
      controller.enqueue(newFrame);
    } finally {
      frame.close();
    }
  }
  async update(opts) {
    this.options = opts;
    if (opts.blurRadius) {
      this.blurRadius = opts.blurRadius;
    } else if (opts.imagePath) {
      await this.loadBackground(opts.imagePath);
    }
  }
  async drawVirtualBackground2(frame) {
    var _a;
    if (!this.canvas || !this.ctx || !this.segmentationResults || !this.inputVideo)
      return;
    if ((_a = this.segmentationResults) == null ? void 0 : _a.categoryMask) {
      this.ctx.filter = "blur(4px)";
      this.ctx.globalCompositeOperation = "destination-atop";
      const bitmap = await maskToBitmap(
        this.segmentationResults.categoryMask,
        this.segmentationResults.categoryMask.width,
        this.segmentationResults.categoryMask.height
      );
      this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.filter = "none";
      this.ctx.globalCompositeOperation = "source-in";
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
          this.canvas.height
        );
      } else {
        this.ctx.fillStyle = "#00FF00";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.ctx.globalCompositeOperation = "destination-over";
    }
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }
  async drawVirtualBackground(frame) {
    var _a, _b;
    if (!this.canvas || !this.ctx || !this.segmentationResults || !this.inputVideo)
      return;
    if ((_a = this.segmentationResults) == null ? void 0 : _a.confidenceMasks) {
      this.ctx.filter = "blur(2px)";
      this.ctx.globalCompositeOperation = "destination-atop";
      const mask = (_b = this.segmentationResults) == null ? void 0 : _b.confidenceMasks[0];
      if (mask && mask.height == 0) {
        return;
      }
      const bitmap = await maskToBitmap(mask, mask.width, mask.height);
      this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.filter = "none";
      this.ctx.globalCompositeOperation = "source-in";
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
          this.canvas.height
        );
      } else {
        this.ctx.fillStyle = "#00FF00";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.ctx.globalCompositeOperation = "destination-over";
    }
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }
  async blurBackground(frame) {
    var _a, _b;
    if (!this.ctx || !this.canvas || !((_b = (_a = this.segmentationResults) == null ? void 0 : _a.categoryMask) == null ? void 0 : _b.canvas) || !this.inputVideo) {
      return;
    }
    this.ctx.save();
    this.ctx.globalCompositeOperation = "copy";
    const bitmap = await maskToBitmap(
      this.segmentationResults.categoryMask,
      this.segmentationResults.categoryMask.width,
      this.segmentationResults.categoryMask.height
    );
    this.ctx.filter = "blur(0px)";
    this.ctx.globalCompositeOperation = "copy";
    this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = "none";
    this.ctx.globalCompositeOperation = "source-out";
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = "destination-over";
    this.ctx.filter = `blur(${this.blurRadius}px)`;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
};
function maskToBitmap(mask, videoWidth, videoHeight) {
  const dataArray = new Uint8ClampedArray(videoWidth * videoHeight * 4);
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

// src/transformers/RVMTransformer.ts
var _tfjs = require('@tensorflow/tfjs'); var tf2 = _interopRequireWildcard(_tfjs); var tf = _interopRequireWildcard(_tfjs);

// src/transformers/rvm.ts

var model;
var outputNodes = ["fgr", "pha", "r1o", "r2o", "r3o", "r4o"];
var t = {};
var ratio = 0;
function init(config) {
  tf.dispose([t.r1i, t.r2i, t.r3i, t.r4i, t.downsample_ratio]);
  t.r1i = tf.tensor(0);
  t.r2i = tf.tensor(0);
  t.r3i = tf.tensor(0);
  t.r4i = tf.tensor(0);
  ratio = config.ratio;
  t.downsample_ratio = tf.tensor(config.ratio);
}
async function load(config) {
  model = await tf.loadGraphModel(config.modelPath);
  init(config);
  return model;
}
function getRGBA(fgr, pha) {
  const norm = (r) => tf.tidy(() => {
    const squeeze2 = tf.squeeze(r, [0]);
    const mul2 = tf.mul(squeeze2, 255);
    const cast2 = tf.cast(mul2, "int32");
    return cast2;
  });
  const rgb = fgr ? norm(fgr) : tf.fill([pha.shape[1] || 0, pha.shape[2] || 0, 3], 255, "int32");
  const a = pha ? norm(pha) : tf.fill([fgr.shape[1] || 0, fgr.shape[2] || 0, 1], 255, "int32");
  const rgba = tf.concat([rgb, a], -1);
  tf.dispose([rgb, a]);
  return rgba;
}
function getState(state) {
  return tf.tidy(() => {
    const r = {};
    r.unstack = tf.unstack(state, -1);
    r.concat = tf.concat(r.unstack, 1);
    r.split = tf.split(r.concat, 4, 1);
    r.stack = tf.concat(r.split, 2);
    r.squeeze = tf.squeeze(r.stack, [0]);
    r.expand = tf.expandDims(r.squeeze, -1);
    r.add = tf.add(r.expand, 1);
    r.mul = tf.mul(r.add, 127.5);
    r.cast = tf.cast(r.mul, "int32");
    r.tile = tf.tile(r.cast, [1, 1, 3]);
    r.alpha = tf.fill([r.tile.shape[0] || 0, r.tile.shape[1] || 0, 1], 255, "int32");
    return tf.concat([r.tile, r.alpha], -1);
  });
}
async function predict(tensor2, config) {
  const expand = tf.expandDims(tensor2, 0);
  t.src = tf.div(expand, 255);
  if (ratio !== config.ratio)
    init(config);
  const [fgr, pha, r1o, r2o, r3o, r4o] = await model.executeAsync(t, outputNodes);
  let rgba;
  switch (config.mode) {
    case "default":
      rgba = getRGBA(fgr, pha);
      break;
    case "alpha":
      rgba = getRGBA(null, pha);
      break;
    case "foreground":
      rgba = getRGBA(fgr, null);
      break;
    case "state":
      rgba = getState(r1o);
      break;
    default:
      rgba = tf.tensor(0);
  }
  tf.dispose([t.src, expand, fgr, pha, t.r1i, t.r2i, t.r3i, t.r4i]);
  [t.r1i, t.r2i, t.r3i, t.r4i] = [r1o, r2o, r3o, r4o];
  return rgba;
}

// src/transformers/RVMTransformer.ts
var segmentationConfig = {
  modelPath: "./rvm.json",
  ratio: 0.3,
  mode: "default"
};
var log = (...msg) => console.log(...msg);
var RVMBackgroundProcessor = class extends VideoTransformer {
  constructor(opts) {
    super();
    this.backgroundImage = null;
    this.options = opts;
    this.update(opts);
    this.tempCanvas = document.createElement("canvas");
  }
  static get isSupported() {
    return typeof OffscreenCanvas !== "undefined";
  }
  async init({ outputCanvas, inputElement: inputVideo }) {
    var _a;
    await super.init({ outputCanvas, inputElement: inputVideo });
    this.tempCanvas.width = outputCanvas.width;
    this.tempCanvas.height = outputCanvas.height;
    await tf2.setBackend("webgl");
    await tf2.ready();
    tf2.env().set("WEBGL_USE_SHAPES_UNIFORMS", true);
    await load(segmentationConfig);
    log({ segmentationConfig });
    log({ tf: tf2.version_core, backend: tf2.getBackend(), state: tf2.engine().state });
    if (((_a = this.options) == null ? void 0 : _a.imagePath) && !this.backgroundImage) {
      await this.loadBackground(this.options.imagePath).catch((err) => console.error("Error while loading processor background image: ", err));
    }
  }
  async destroy() {
    await super.destroy();
    this.backgroundImage = null;
  }
  async loadBackground(path) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = path;
    });
    const imageData = await createImageBitmap(img);
    this.backgroundImage = imageData;
  }
  async transform(frame, controller) {
    try {
      if (this.isDisabled) {
        controller.enqueue(frame);
        return;
      }
      if (!this.canvas) {
        throw TypeError("Canvas needs to be initialized first");
      }
      const imageBitmap = await createImageBitmap(frame);
      const imageTensor = tf2.browser.fromPixels(imageBitmap);
      segmentationConfig.mode = "default";
      segmentationConfig.ratio = 0.5;
      const rgba = await predict(imageTensor, segmentationConfig);
      tf2.browser.toPixels(rgba, this.tempCanvas);
      if (this.ctx) {
        const imageBitmap2 = await createImageBitmap(this.tempCanvas);
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
            this.canvas.height
          );
        }
        this.ctx.drawImage(imageBitmap2, 0, 0);
      }
      tf2.dispose([imageTensor, rgba]);
      const newFrame = new VideoFrame(this.canvas, {
        timestamp: frame.timestamp || Date.now()
      });
      controller.enqueue(newFrame);
    } finally {
      frame.close();
    }
  }
  async update(opts) {
    this.options = opts;
    if (opts.blurRadius) {
      this.blurRadius = opts.blurRadius;
    } else if (opts.imagePath) {
      await this.loadBackground(opts.imagePath);
    }
  }
  async drawVirtualBackground(frame) {
    if (!this.canvas || !this.ctx)
      return;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }
  async blurBackground(frame) {
    var _a, _b;
    if (!this.ctx || !this.canvas || !((_b = (_a = this.segmentationResults) == null ? void 0 : _a.categoryMask) == null ? void 0 : _b.canvas) || !this.inputVideo) {
      return;
    }
    this.ctx.save();
    this.ctx.globalCompositeOperation = "copy";
    const bitmap = await maskToBitmap2(
      this.segmentationResults.categoryMask,
      this.segmentationResults.categoryMask.width,
      this.segmentationResults.categoryMask.height
    );
    this.ctx.filter = "blur(3px)";
    this.ctx.globalCompositeOperation = "copy";
    this.ctx.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.filter = "none";
    this.ctx.globalCompositeOperation = "source-out";
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = "destination-over";
    this.ctx.filter = `blur(${this.blurRadius}px)`;
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
};
function maskToBitmap2(mask, videoWidth, videoHeight) {
  const dataArray = new Uint8ClampedArray(videoWidth * videoHeight * 4);
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

// src/index.ts
var BackgroundBlur = (blurRadius = 10, segmenterOptions) => {
  return BackgroundProcessor2({ blurRadius, segmenterOptions }, "background-blur");
};
var VirtualBackground = (imagePath, segmenterOptions) => {
  return BackgroundProcessor2({ imagePath, segmenterOptions }, "virtual-background");
};
var BackgroundProcessor2 = (options, name = "background-processor") => {
  const isProcessorSupported = ProcessorWrapper.isSupported && BackgroundProcessor.isSupported;
  if (!isProcessorSupported) {
    throw new Error("processor is not supported in this browser");
  }
  const processor = new ProcessorWrapper(new BackgroundProcessor(options), name);
  return processor;
};
var RVMBackgroundProcessor2 = (options, name = "background-processor") => {
  const isProcessorSupported = ProcessorWrapper.isSupported && RVMBackgroundProcessor.isSupported;
  if (!isProcessorSupported) {
    throw new Error("processor is not supported in this browser");
  }
  const processor = new ProcessorWrapper(new RVMBackgroundProcessor(options), name);
  return processor;
};








exports.BackgroundBlur = BackgroundBlur; exports.BackgroundProcessor = BackgroundProcessor2; exports.BackgroundTransformer = BackgroundProcessor; exports.ProcessorWrapper = ProcessorWrapper; exports.RVMBackgroundProcessor = RVMBackgroundProcessor2; exports.VideoTransformer = VideoTransformer; exports.VirtualBackground = VirtualBackground;
//# sourceMappingURL=index.js.map
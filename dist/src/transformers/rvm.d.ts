import * as tf from '@tensorflow/tfjs';
/**
 * Segmentation mode controls values returned by `predict` method
 * - `default` returns RGBA 4-channel tensor
 * - `alpha` returns Alpha 1-channel tensor
 * - `foreground` returns RGBA internally calculated foreground states
 * - `state` returns internal recurrent states as transferred between frames
 */
export type SegmentationMode = 'default' | 'alpha' | 'foreground' | 'state';
/**
 * RVM Segmentation Model configuration
 */
export type SegmentationConfig = {
    modelPath: string;
    ratio: number;
    mode: SegmentationMode;
};
/**
 * Loads RVM graph model from location specified in `config.modelPath`
 * and initialized initial states
 *
 * @param config SegmentationConfig
 * @returns GraphModel
 */
export declare function load(config: SegmentationConfig): Promise<tf.GraphModel>;
/**
 * Runs model prediction based and returns processed image as tensor
 * Note that execution speed is directly related to input image resolution
 *
 * @param tensor Input tensor representing RGB image [width, height, channels = 3] where width and height can be dynamic
 * @param config Controls model post-processing and return values
 * @returns Tensor as [width, height, channels] where channels can be 4 (full RGBA) or 1(alpha-only) depending on `config`
 */
export declare function predict(tensor: tf.Tensor, config: SegmentationConfig): Promise<tf.Tensor3D>;

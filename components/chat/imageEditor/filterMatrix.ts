import { ImageFilterValues } from "./types";

/**
 * Identity 4×5 color matrix (20 elements, row-major).
 */
const IDENTITY: number[] = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

const MATRIX_SIZE = 20;
const COLS = 5;
const ROWS = 4;

/** Multiply two 4×5 matrices (a × b). */
const multiplyMatrices = (a: number[], b: number[]): number[] => {
  const result = new Array(MATRIX_SIZE).fill(0);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      let sum = 0;

      for (let k = 0; k < ROWS; k++) {
        sum += a[row * COLS + k] * b[k * COLS + col];
      }

      // Add the offset column contribution
      if (col === COLS - 1) {
        sum += a[row * COLS + (COLS - 1)];
      }

      result[row * COLS + col] = sum;
    }
  }

  return result;
};

/** Concatenate multiple 4×5 color matrices. */
const concatMatrices = (...matrices: number[][]): number[] =>
  matrices.reduce((acc, mat) => multiplyMatrices(acc, mat), [...IDENTITY]);

// ─── Individual filter matrix builders ──────────────────────────────────────

/** Brightness: amount -100..100 → scaled to -0.3..0.3 for reasonable offset */
const brightnessMatrix = (amount: number): number[] => {
  const v = (amount / 100) * 0.3;
  return [
    1, 0, 0, 0, v,
    0, 1, 0, 0, v,
    0, 0, 1, 0, v,
    0, 0, 0, 1, 0,
  ];
};

/** Contrast: amount -100..100 → scaled. 0 = normal, -100 = low, 100 = high */
const contrastMatrix = (amount: number): number[] => {
  // Map -100..100 to roughly 0.3 .. 2.0
  const scale = amount < 0 ? 1 + (amount / 100) * 0.7 : 1 + (amount / 100);
  const offset = (-0.5 * scale + 0.5);
  return [
    scale, 0, 0, 0, offset,
    0, scale, 0, 0, offset,
    0, 0, scale, 0, offset,
    0, 0, 0, 1, 0,
  ];
};

/** Exposure: multiplicative brightness. -100..100 */
const exposureMatrix = (amount: number): number[] => {
  // map -100..100 to -1..1, then 2^x gives 0.5 .. 2.0
  const scale = Math.pow(2, amount / 100);
  return [
    scale, 0, 0, 0, 0,
    0, scale, 0, 0, 0,
    0, 0, scale, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

/** Saturation: amount -100..100 → 0 = grayscale, 100 = oversaturated */
const saturationMatrix = (amount: number): number[] => {
  // -100 -> 0 (grayscale), 0 -> 1 (normal), 100 -> 2.5 (saturated)
  const s = amount < 0 ? 1 + (amount / 100) : 1 + (amount / 100) * 1.5;
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  const sr = (1 - s) * lr;
  const sg = (1 - s) * lg;
  const sb = (1 - s) * lb;

  return [
    sr + s, sg, sb, 0, 0,
    sr, sg + s, sb, 0, 0,
    sr, sg, sb + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

/**
 * Vibrance: smart saturation that protects already-saturated channels.
 * Approximated by applying a weaker saturation boost and tinting.
 */
const vibranceMatrix = (amount: number): number[] => {
  const dampened = (amount / 100) * 0.8;
  const s = 1 + dampened;
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  const sr = (1 - s) * lr;
  const sg = (1 - s) * lg;
  const sb = (1 - s) * lb;

  return [
    sr + s, sg, sb, 0, 0,
    sr, sg + s, sb, 0, 0,
    sr, sg, sb + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

/** Hue rotation: degrees -180..180 */
const hueMatrix = (degrees: number): number[] => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;

  return [
    lr + cos * (1 - lr) + sin * (-lr),
    lg + cos * (-lg) + sin * (-lg),
    lb + cos * (-lb) + sin * (1 - lb),
    0, 0,

    lr + cos * (-lr) + sin * 0.143,
    lg + cos * (1 - lg) + sin * 0.14,
    lb + cos * (-lb) + sin * (-0.283),
    0, 0,

    lr + cos * (-lr) + sin * (-(1 - lr)),
    lg + cos * (-lg) + sin * lg,
    lb + cos * (1 - lb) + sin * lb,
    0, 0,

    0, 0, 0, 1, 0,
  ];
};

/** Temperature (warmth): amount -100..100. Negative = cool (blue), positive = warm (yellow) */
const temperatureMatrix = (amount: number): number[] => {
  // Normalize to -0.2..0.2
  const r = (amount / 100) * 0.2;
  const b = -(amount / 100) * 0.2;

  return [
    1 + r, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1 + b, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

// ─── Public API ─────────────────────────────────────────────────────────────

/** Build a combined 20-element ColorMatrix from filter values. */
export const buildFilterMatrix = (values: ImageFilterValues): number[] => {
  const matrices: number[][] = [];

  if (values.brightness !== 0) matrices.push(brightnessMatrix(values.brightness));
  if (values.contrast !== 0) matrices.push(contrastMatrix(values.contrast));
  if (values.exposure !== 0) matrices.push(exposureMatrix(values.exposure));
  if (values.saturation !== 0) matrices.push(saturationMatrix(values.saturation));
  if (values.vibrance !== 0) matrices.push(vibranceMatrix(values.vibrance));
  if (values.hue !== 0) matrices.push(hueMatrix(values.hue));
  if (values.temperature !== 0) matrices.push(temperatureMatrix(values.temperature));

  if (matrices.length === 0) return [...IDENTITY];

  return concatMatrices(...matrices);
};

/** Check whether any filter is non-default. */
export const hasActiveFilters = (values: ImageFilterValues): boolean =>
  Object.values(values).some(v => v !== 0);


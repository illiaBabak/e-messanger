import { SkPath } from "@shopify/react-native-skia";

// ─── Filter Values ────────────────────────────────────────────────────────────
/** All values range from -1 to 1 (0 = no change), except hue which is -180..180 */
export type ImageFilterValues = {
  brightness: number;
  contrast: number;
  exposure: number;
  saturation: number;
  vibrance: number;
  hue: number;
  temperature: number;
};

export const DEFAULT_FILTER_VALUES: ImageFilterValues = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  temperature: 0,
};

// ─── Drawing ──────────────────────────────────────────────────────────────────
export type DrawingPath = {
  path: SkPath;
  color: string;
  strokeWidth: number;
  isEraser: boolean;
};

// ─── Crop ─────────────────────────────────────────────────────────────────────
export type CropRegion = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

// ─── Editor Mode ──────────────────────────────────────────────────────────────
export type EditorMode = "none" | "crop" | "paint" | "filters";

// ─── Paint Config ─────────────────────────────────────────────────────────────
export const PAINT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#AF52DE",
] as const;

export const BRUSH_SIZES = {
  small: 3,
  medium: 6,
  large: 12,
} as const;

export type BrushSize = keyof typeof BRUSH_SIZES;

// ─── Filter Slider Config ─────────────────────────────────────────────────────
export type FilterKey = keyof ImageFilterValues;

export type FilterSliderConfig = {
  key: FilterKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

export const FILTER_SLIDER_CONFIGS: FilterSliderConfig[] = [
  { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1 },
  { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1 },
  { key: "exposure", label: "Exposure", min: -100, max: 100, step: 1 },
  { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1 },
  { key: "vibrance", label: "Vibrance", min: -100, max: 100, step: 1 },
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1 },
  { key: "temperature", label: "Temperature", min: -100, max: 100, step: 1 },
];

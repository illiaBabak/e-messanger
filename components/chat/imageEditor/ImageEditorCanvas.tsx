import {
  BlendMode,
  Canvas,
  ColorMatrix,
  Group,
  ImageFormat,
  PaintStyle,
  Path,
  Skia,
  Image as SkiaImage,
  SkImage,
  StrokeCap,
  StrokeJoin,
  useImage
} from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { buildFilterMatrix } from "./filterMatrix";
import { DrawingPath, ImageFilterValues } from "./types";

type ImageEditorCanvasProps = {
  imageUri: string;
  filterValues: ImageFilterValues;
  paths: DrawingPath[];
  currentPath: DrawingPath | null;
  canvasWidth: number;
  canvasHeight: number;
  bottomReservedSpace?: number;
  onReady?: () => void;
};

export type ImageEditorCanvasRef = {
  makeSnapshot: () => SkImage | null;
  exportImage: () => string | null;
};

export const ImageEditorCanvas = React.memo(
  forwardRef<ImageEditorCanvasRef, ImageEditorCanvasProps>(
    (
      {
        imageUri,
        filterValues,
        paths,
        currentPath,
        canvasWidth,
        canvasHeight,
        bottomReservedSpace = 0,
        onReady,
      },
      ref,
    ) => {
      const canvasRef = useRef<any>(null);
      const image = useImage(imageUri);

      // Notify parent when image is loaded to prevent flickering
      React.useEffect(() => {
        if (image) {
          onReady?.();
        }
      }, [image, onReady]);

      const matrix = useMemo(() => buildFilterMatrix(filterValues), [filterValues]);

      const layerPaint = useMemo(() => {
        const p = Skia.Paint();
        p.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
        return p;
      }, [matrix]);

      // Calculate layout math, memoized so we can reuse it for the UI and export
      const layout = useMemo(() => {
        let drawWidth = canvasWidth;
        let drawHeight = canvasHeight;
        let offsetX = 0;
        let offsetY = 0;

        const availableHeight = canvasHeight - bottomReservedSpace;

        if (image && canvasWidth > 0 && availableHeight > 0) {
          const imageAspect = image.width() / image.height();
          const containerAspect = canvasWidth / availableHeight;

          if (imageAspect > containerAspect) {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imageAspect;
            offsetX = 0;
            offsetY = (availableHeight - drawHeight) / 2;
          } else {
            drawHeight = availableHeight;
            drawWidth = availableHeight * imageAspect;
            offsetX = (canvasWidth - drawWidth) / 2;
            offsetY = 0;
          }
        }

        return { drawWidth, drawHeight, offsetX, offsetY };
      }, [image, canvasWidth, canvasHeight, bottomReservedSpace]);

      useImperativeHandle(ref, () => ({
        // UI Snapshot (low-res, includes letterboxing)
        makeSnapshot: () => {
          if (!canvasRef.current) return null;
          return canvasRef.current.makeImageSnapshot() as SkImage | null;
        },
        // High-quality native resolution export
        exportImage: () => {
          if (!image) return null;

          const nativeWidth = image.width();
          const nativeHeight = image.height();
        
          // Ensure size doesn't crash the device due to memory (cap to ~4k if needed, but usually fine)
          const surface = Skia.Surface.Make(nativeWidth, nativeHeight);
          if (!surface) return null;

          const canvas = surface.getCanvas();
        
          // Draw the image with filters
          const paint = Skia.Paint();
          const colorFilter = Skia.ColorFilter.MakeMatrix(matrix);
          paint.setColorFilter(colorFilter);
          canvas.drawImage(image, 0, 0, paint);

          // Draw the paths
          const allPaths = currentPath ? [...paths, currentPath] : paths;
          allPaths.forEach(drawPath => {
            const pathPaint = Skia.Paint();
            pathPaint.setStyle(PaintStyle.Stroke);
            pathPaint.setStrokeWidth(drawPath.strokeWidth); // Already in native pixels
            pathPaint.setStrokeCap(StrokeCap.Round);
            pathPaint.setStrokeJoin(StrokeJoin.Round);
          
            if (drawPath.isEraser) {
              pathPaint.setBlendMode(BlendMode.Clear);
              pathPaint.setColor(Skia.Color("#00000000"));
            } else {
              pathPaint.setBlendMode(BlendMode.SrcOver);
              pathPaint.setColor(Skia.Color(drawPath.color));
            }

            canvas.drawPath(drawPath.path, pathPaint);
          });

          const snapshot = surface.makeImageSnapshot();
          const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 90);
          return `data:image/jpeg;base64,${base64}`;
        },
      }));

      if (canvasWidth === 0 || canvasHeight === 0) return null;

      const allPaths = currentPath ? [...paths, currentPath] : paths;

      return (
        <View style={styles.container}>
          <Canvas
            ref={canvasRef}
            style={{ width: canvasWidth, height: canvasHeight }}
            opaque={false}
          >
            <Group layer={layerPaint}>
              {image && (
                <SkiaImage
                  image={image}
                  x={layout.offsetX}
                  y={layout.offsetY}
                  width={layout.drawWidth}
                  height={layout.drawHeight}
                />
              )}
            </Group>

            <Group
              matrix={useMemo(() => {
                if (!image) return Skia.Matrix();
                const m = Skia.Matrix();
                m.translate(layout.offsetX, layout.offsetY);
                m.scale(layout.drawWidth / image.width(), layout.drawHeight / image.height());
                return m;
              }, [image, layout])}
            >
              {allPaths.map((drawPath, index) => (
                <Path
                  key={index}
                  path={drawPath.path}
                  color={drawPath.isEraser ? "transparent" : drawPath.color}
                  style="stroke"
                  strokeWidth={drawPath.strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                  blendMode={drawPath.isEraser ? "clear" : "srcOver"}
                />
              ))}
            </Group>
          </Canvas>
        </View>
      );
    }
  )
);

ImageEditorCanvas.displayName = "ImageEditorCanvas";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

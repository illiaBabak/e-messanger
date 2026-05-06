import { Ionicons } from "@expo/vector-icons";
import { Skia } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const EDIT_MODE_SCALE = 1;
const EDIT_MODE_TRANSLATE_Y = -(SCREEN_HEIGHT * 0.11);
const ANIMATION_DURATION = 250;
const BOTTOM_CONTROLS_HEIGHT = 180;

import {
  BRUSH_SIZES,
  BrushSize,
  CropOverlay,
  CropRegion,
  DEFAULT_FILTER_VALUES,
  DrawingPath,
  EditorMode,
  EditorToolbar,
  FilterKey,
  FiltersPanel,
  ImageEditorCanvas,
  ImageEditorCanvasRef,
  ImageFilterValues,
  PAINT_COLORS,
  PaintToolbar,
} from "./imageEditor";

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (width - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
const PAGE_SIZE = 60;

type AttachmentModalProps = {
  visible: boolean;
  onClose: () => void;
  onSendMedia: (uris: string[]) => void;
  contactName: string;
};

type TabType = "Gallery" | "File" | "Canvas";

export const AttachmentModal = ({
  visible,
  onClose,
  onSendMedia,
  contactName,
}: AttachmentModalProps) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("Gallery");
  const [internalVisible, setInternalVisible] = useState(visible);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<MediaLibrary.Asset | null>(null);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(null);
  const [isAlbumDropdownOpen, setIsAlbumDropdownOpen] = useState(false);

  // ─── Editor State ─────────────────────────────────────────────────────────
  const [isSkiaReady, setIsSkiaReady] = useState(false);

  useEffect(() => {
    if (!previewAsset) {
      setIsSkiaReady(false);
    }
  }, [previewAsset]);

  const handleSkiaReady = useCallback(() => {
    setIsSkiaReady(true);
  }, []);

  const [editorMode, setEditorMode] = useState<EditorMode>("none");

  const lastActiveTool = useRef<EditorMode>("none");
  if (editorMode === "paint" || editorMode === "filters") {
    lastActiveTool.current = editorMode;
  }
  const renderTool = editorMode !== "none" ? editorMode : lastActiveTool.current;

  const isEditModeActive = editorMode !== "none";
  const isToolsActive = editorMode === "paint" || editorMode === "filters";

  const animatedPreviewStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(isEditModeActive ? EDIT_MODE_TRANSLATE_Y : 0, {
            duration: ANIMATION_DURATION,
          }),
        },
        {
          scale: withTiming(isEditModeActive ? EDIT_MODE_SCALE : 1, {
            duration: ANIMATION_DURATION,
          }),
        },
      ],
    };
  }, [isEditModeActive]);

  const toolsAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(isToolsActive ? 0 : 250, {
            duration: ANIMATION_DURATION,
          }),
        },
      ],
      opacity: withTiming(isToolsActive ? 1 : 0, {
        duration: ANIMATION_DURATION,
      }),
    };
  }, [isToolsActive]);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const isHeaderHidden = editorMode !== "none";
    return {
      opacity: withTiming(isHeaderHidden ? 0 : 1, {
        duration: ANIMATION_DURATION,
      }),
    };
  }, [editorMode]);

  const [filterValues, setFilterValues] = useState<ImageFilterValues>(DEFAULT_FILTER_VALUES);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [workingUri, setWorkingUri] = useState<string | null>(null);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [paintColor, setPaintColor] = useState<string>(PAINT_COLORS[0]);
  const [brushSize, setBrushSize] = useState<BrushSize>("medium");
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const [imageLayout, setImageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const canvasContainerRef = useRef<View>(null);
  const editorCanvasRef = useRef<ImageEditorCanvasRef>(null);

  // Resolve ph:// URI to a normalized file:// URI (applies EXIF rotation, converts to standard JPEG for Skia)
  useEffect(() => {
    if (!previewAsset) {
      setResolvedUri(null);
      setImageDimensions(null);
      return;
    }

    let cancelled = false;

    const normalizeImage = async () => {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(previewAsset.id);
        const sourceUri = info.localUri ?? previewAsset.uri;
        
        const result = await ImageManipulator.manipulateAsync(
          sourceUri,
          [],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
        );

        if (!cancelled) {
          setResolvedUri(result.uri);
          setImageDimensions({ width: result.width, height: result.height });
        }
      } catch (error) {
        console.warn("Failed to normalize image, falling back to original", error);
        if (!cancelled) {
          setResolvedUri(previewAsset.uri);
          setImageDimensions({ width: previewAsset.width, height: previewAsset.height });
        }
      }
    };

    normalizeImage();

    return () => {
      cancelled = true;
    };
  }, [previewAsset]);

  const translateY = useRef(new Animated.Value(height)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const DISMISS_THRESHOLD = 120;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward vertical drags
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging downward (dy >= 0)
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD) {
          // Dismiss the modal
          onCloseRef.current();
        } else {
          // Snap back to original position
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
            speed: 14,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 8,
          speed: 14,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 12,
        }),
      ]).start();

      if (activeTab === "Gallery" && hasPermission === null) {
        requestMediaPermissions();
      }
    } else if (internalVisible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSelectedUris(new Set());
        setActiveTab("Gallery");
        setPreviewAsset(null);
        resetEditorState();
        dragY.setValue(0);
        setInternalVisible(false);
      });
    }
  }, [visible, internalVisible]);

  const requestMediaPermissions = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasPermission(status === "granted");
    if (status === "granted") {
      fetchPhotos(null);
      MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
        .then(result => setAlbums(result))
        .catch(console.error);
    }
  };

  const fetchPhotos = async (album: MediaLibrary.Album | null = selectedAlbum) => {
    setIsLoading(true);
    setAssets([]);
    setEndCursor(undefined);
    setHasNextPage(true);

    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: "photo",
        first: PAGE_SIZE,
        sortBy: ["creationTime"],
        ...(album ? { album: album.id } : {}),
      });

      setAssets(result.assets);
      setEndCursor(result.endCursor);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      console.error("Failed to fetch photos", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasPermission) {
      fetchPhotos(selectedAlbum);
      const subscription = MediaLibrary.addListener(() => {
        fetchPhotos(selectedAlbum);
      });
      return () => {
        subscription.remove();
      };
    }
  }, [hasPermission, selectedAlbum]);

  const fetchMorePhotos = async () => {
    if (isLoadingMore || !hasNextPage || !endCursor) return;
    setIsLoadingMore(true);

    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: "photo",
        first: PAGE_SIZE,
        after: endCursor,
        sortBy: ["creationTime"],
        ...(selectedAlbum ? { album: selectedAlbum.id } : {}),
      });

      setAssets(prev => [...prev, ...result.assets]);
      setEndCursor(result.endCursor);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      console.error("Failed to fetch more photos", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      alert("Sorry, we need camera permissions to make this work!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onSendMedia([result.assets[0].uri]);
      onClose();
    }
  };

  const toggleSelection = (uri: string) => {
    setSelectedUris(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleSendSelected = () => {
    if (selectedUris.size > 0) {
      onSendMedia(Array.from(selectedUris));
      onClose();
    }
  };

  // Check if any edits (drawings or filters) have been applied
  const hasEdits = useCallback(() => {
    if (drawingPaths.length > 0) return true;

    const keys = Object.keys(filterValues) as FilterKey[];
    return keys.some(key => filterValues[key] !== DEFAULT_FILTER_VALUES[key]);
  }, [drawingPaths, filterValues]);

  // Export the edited image using Skia offscreen rendering for full native resolution
  const exportEditedImage = useCallback(async (): Promise<string | null> => {
    // We use the new exportImage method to get the native resolution image with scaled paths
    const dataUri = editorCanvasRef.current?.exportImage();
    if (!dataUri) return null;

    try {
      // Use ImageManipulator to convert the data URI to a file:// URI, since sending
      // raw base64 over the bridge to Firebase Storage can be problematic.
      const result = await ImageManipulator.manipulateAsync(
        dataUri,
        [],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      return result.uri;
    } catch (error) {
      console.error("Failed to export edited image", error);
      return null;
    }
  }, []);

    // ─── Editor Helpers ──────────────────────────────────────────────────────
  const resetEditorState = useCallback(() => {
    setEditorMode("none");
    setFilterValues(DEFAULT_FILTER_VALUES);
    setDrawingPaths([]);
    setCurrentPath(null);
    setWorkingUri(null);
    setResolvedUri(null);
    setImageDimensions(null);
    setPaintColor(PAINT_COLORS[0]);
    setBrushSize("medium");
    setIsEraserActive(false);
  }, []);

  const handleSendPreview = useCallback(async () => {
    if (!previewAsset) return;

    let currentUri = workingUri ?? previewAsset.uri;

    // If there are drawings or filter changes, flatten them into the image
    if (hasEdits()) {
      const exportedUri = await exportEditedImage();
      if (exportedUri) {
        currentUri = exportedUri;
      }
    }

    const urisToSend = selectedUris.has(previewAsset.uri)
      ? Array.from(selectedUris).map(uri =>
          uri === previewAsset.uri ? currentUri : uri,
        )
      : [...Array.from(selectedUris), currentUri];
    onSendMedia(urisToSend);
    onClose();
  }, [previewAsset, workingUri, selectedUris, hasEdits, exportEditedImage, onSendMedia, onClose]);



  const handleBackFromPreview = useCallback(() => {
    setPreviewAsset(null);
    resetEditorState();
  }, [resetEditorState]);

  const handleFilterChange = useCallback((key: FilterKey, value: number) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilterValues(DEFAULT_FILTER_VALUES);
  }, []);

  const handlePaintUndo = useCallback(() => {
    setDrawingPaths(prev => prev.slice(0, -1));
  }, []);

  const handleEraserToggle = useCallback(() => {
    setIsEraserActive(prev => !prev);
  }, []);

  const handleCropApply = useCallback(
    async (region: CropRegion) => {
      if (!previewAsset) return;

      const sourceUri = workingUri ?? resolvedUri;
      if (!sourceUri) return;

      try {
        // Get the original image dimensions to calculate absolute crop values
        const imageInfo = await ImageManipulator.manipulateAsync(sourceUri, []);
        const imgWidth = imageInfo.width;
        const imgHeight = imageInfo.height;

        const cropAction: ImageManipulator.Action = {
          crop: {
            originX: Math.round(region.originX * imgWidth),
            originY: Math.round(region.originY * imgHeight),
            width: Math.round(region.width * imgWidth),
            height: Math.round(region.height * imgHeight),
          },
        };

        const result = await ImageManipulator.manipulateAsync(
          sourceUri,
          [cropAction],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
        );

        // Map existing drawings to the new cropped coordinate system
        const ox = Math.round(region.originX * imgWidth);
        const oy = Math.round(region.originY * imgHeight);
        
        const shiftedPaths = drawingPaths.map(drawPath => {
          const newPath = Skia.Path.MakeFromSVGString(drawPath.path.toSVGString());
          if (!newPath) return drawPath;
          
          const matrix = Skia.Matrix();
          matrix.translate(-ox, -oy);
          newPath.transform(matrix);
          
          return { ...drawPath, path: newPath };
        });

        setDrawingPaths(shiftedPaths);
        setWorkingUri(result.uri);
        setImageDimensions({ width: result.width, height: result.height });
        setCurrentPath(null);
        setIsSkiaReady(false); // Reset readiness for new image
      } catch (error) {
        console.error("Failed to crop image", error);
      }

      setEditorMode("none");
    },
    [previewAsset, workingUri, resolvedUri, drawingPaths],
  );

  const handleCropCancel = useCallback(() => {
    setEditorMode("none");
  }, []);

  // Compute the actual image rect within the container (accounting for contentFit="contain")
  const computeContainedImageLayout = useCallback(
    (containerX: number, containerY: number, containerW: number, containerH: number) => {
      if (!imageDimensions || containerW === 0 || containerH === 0) {
        return { x: containerX, y: containerY, width: containerW, height: containerH };
      }

      const availableHeight = containerH;
      const imageAspect = imageDimensions.width / imageDimensions.height;
      const containerAspect = containerW / availableHeight;

      let drawWidth: number;
      let drawHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (imageAspect > containerAspect) {
        // Image is wider — letterbox top/bottom
        drawWidth = containerW;
        drawHeight = containerW / imageAspect;
        offsetX = 0;
        offsetY = (availableHeight - drawHeight) / 2;
      } else {
        // Image is taller — letterbox left/right
        drawHeight = availableHeight;
        drawWidth = availableHeight * imageAspect;
        offsetX = (containerW - drawWidth) / 2;
        offsetY = 0;
      }

      return {
        x: containerX + offsetX,
        y: containerY + offsetY,
        width: drawWidth,
        height: drawHeight,
      };
    },
    [imageDimensions],
  );

  // ─── Paint Touch Handlers ───────────────────────────────────────────────
  const handlePaintTouchStart = useCallback(
    (locationX: number, locationY: number) => {
      if (editorMode !== "paint" || !imageDimensions) return;
      
      const layout = computeContainedImageLayout(0, 0, canvasLayout.width, canvasLayout.height);
      const scale = imageDimensions.width / layout.width;
      
      const clampedX = Math.max(layout.x, Math.min(locationX, layout.x + layout.width));
      const clampedY = Math.max(layout.y, Math.min(locationY, layout.y + layout.height));

      const nx = (clampedX - layout.x) * scale;
      const ny = (clampedY - layout.y) * scale;

      const path = Skia.Path.Make();
      path.moveTo(nx, ny);

      setCurrentPath({
        path,
        color: paintColor,
        strokeWidth: BRUSH_SIZES[brushSize] * scale, // Store native-pixel stroke width
        isEraser: isEraserActive,
      });
    },
    [editorMode, paintColor, brushSize, isEraserActive, imageDimensions, canvasLayout, computeContainedImageLayout],
  );

  const handlePaintTouchMove = useCallback(
    (locationX: number, locationY: number) => {
      if (editorMode !== "paint" || !currentPath || !imageDimensions) return;
      
      const layout = computeContainedImageLayout(0, 0, canvasLayout.width, canvasLayout.height);
      const scale = imageDimensions.width / layout.width;
      
      const clampedX = Math.max(layout.x, Math.min(locationX, layout.x + layout.width));
      const clampedY = Math.max(layout.y, Math.min(locationY, layout.y + layout.height));

      const nx = (clampedX - layout.x) * scale;
      const ny = (clampedY - layout.y) * scale;

      currentPath.path.lineTo(nx, ny);
      // Force re-render with new reference
      setCurrentPath({ ...currentPath });
    },
    [editorMode, currentPath, imageDimensions, canvasLayout, computeContainedImageLayout],
  );

  const handlePaintTouchEnd = useCallback(() => {
    if (currentPath) {
      setDrawingPaths(prev => [...prev, currentPath]);
      setCurrentPath(null);
    }
  }, [currentPath]);


  const handleCanvasContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCanvasLayout({ width: w, height: h });

    // Use pure local coordinates (0,0) for robust layout mapping
    setImageLayout(computeContainedImageLayout(0, 0, w, h));
  }, [computeContainedImageLayout]);

  // Recompute image layout immediately whenever dimensions or container size changes
  useEffect(() => {
    if (canvasLayout.width > 0 && canvasLayout.height > 0) {
      setImageLayout(computeContainedImageLayout(0, 0, canvasLayout.width, canvasLayout.height));
    }
  }, [computeContainedImageLayout, canvasLayout]);

  // ─── Gallery Item ─────────────────────────────────────────────────────────
  const renderGalleryItem = ({ item }: { item: MediaLibrary.Asset | "camera" }) => {
    if (item === "camera") {
      return (
        <Pressable style={[styles.galleryItem, styles.cameraItem]} onPress={handleTakePhoto}>
          <Ionicons name="camera" size={32} color={Colors.white} />
          <Text style={styles.cameraText}>Camera</Text>
        </Pressable>
      );
    }

    const isSelected = selectedUris.has(item.uri);

    return (
      <Pressable style={styles.galleryItem} onPress={() => setPreviewAsset(item)}>
        <Image source={item.uri} style={styles.galleryImage} contentFit="cover" />
        {isSelected && <View style={styles.selectedDimOverlay} />}
        {/* Select circle — top-right corner */}
        <Pressable
          style={styles.selectCircleWrapper}
          onPress={() => toggleSelection(item.uri)}
          hitSlop={8}
        >
          <View style={[styles.selectCircle, isSelected && styles.selectCircleFilled]}>
            {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
          </View>
        </Pressable>
      </Pressable>
    );
  };

  // ─── Gallery ──────────────────────────────────────────────────────────────
  const renderGallery = () => {
    if (!hasPermission) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Photo library permission is required to view and send photos.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestMediaPermissions}>
            <Text style={styles.permissionButtonText}>Allow Access</Text>
          </Pressable>
        </View>
      );
    }

    if (isLoading && assets.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }

    const data: (MediaLibrary.Asset | "camera")[] = ["camera", ...assets];

    return (
      <View style={styles.galleryContainer}>
        <FlatList
          data={data}
          keyExtractor={item => (item === "camera" ? "camera" : item.id)}
          numColumns={COLUMN_COUNT}
          renderItem={renderGalleryItem}
          contentContainerStyle={styles.galleryContent}
          showsVerticalScrollIndicator={false}
          onEndReached={fetchMorePhotos}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
        />
      </View>
    );
  };

  const renderPlaceholder = (title: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.placeholderContainer}>
      <Ionicons name={icon} size={64} color={Colors.border} />
      <Text style={styles.placeholderText}>{title} coming soon</Text>
    </View>
  );

  if (!internalVisible) return null;

  const isPreviewSelected = previewAsset ? selectedUris.has(previewAsset.uri) : false;

  return (
    <Modal visible={internalVisible} transparent animationType="none">
      <View style={styles.container}>
        {/* Dim overlay — tap to close bottom sheet */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: Animated.add(translateY, dragY) }] },
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Sheet header: drag handle row + 3-column action row */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandleRow}>
              <View style={styles.dragHandle} />
            </View>
            <View style={styles.sheetHeaderRow}>
              {/* Left: close button */}
              <Pressable style={styles.sheetHeaderClose} onPress={onClose}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>

              {/* Center: tab-aware title */}
              <View style={styles.sheetHeaderCenter}>
                {activeTab === "Gallery" && albums.length > 0 ? (
                  <Pressable
                    style={styles.albumPickerButton}
                    onPress={() => setIsAlbumDropdownOpen(prev => !prev)}
                  >
                    <Text style={styles.albumPickerText}>
                      {selectedAlbum ? selectedAlbum.title : "Recents"}
                    </Text>
                    <Ionicons
                      name={isAlbumDropdownOpen ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={Colors.textPrimary}
                      style={{ marginLeft: 4 }}
                    />
                  </Pressable>
                ) : activeTab === "File" ? (
                  <Text style={styles.sheetHeaderTitle}>File</Text>
                ) : activeTab === "Canvas" ? (
                  <Text style={styles.sheetHeaderTitle}>Canvas</Text>
                ) : null}
              </View>

              {/* Right: spacer to balance the close button */}
              <View style={styles.sheetHeaderSpacer} />
            </View>
          </View>

          <View style={styles.contentContainer}>
            {activeTab === "Gallery" && renderGallery()}
            {activeTab === "File" && renderPlaceholder("File Sharing", "document-text")}
            {activeTab === "Canvas" && renderPlaceholder("Canvas", "color-palette")}
          </View>

          <View style={styles.tabBar}>
            {(["Gallery", "File", "Canvas"] as const).map(tab => {
              const iconMap: Record<TabType, keyof typeof Ionicons.glyphMap> = {
                Gallery: "image",
                File: "document",
                Canvas: "brush",
              };
              return (
                <Pressable
                  key={tab}
                  style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Ionicons
                    name={iconMap[tab]}
                    size={24}
                    color={activeTab === tab ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedUris.size > 0 && activeTab === "Gallery" && !previewAsset && (
            <Animated.View style={styles.sendButtonContainer}>
              <Pressable style={styles.sendButton} onPress={handleSendSelected}>
                <Text style={styles.sendButtonText}>
                  Send {selectedUris.size} {selectedUris.size === 1 ? "Photo" : "Photos"}
                </Text>
                <Ionicons name="send" size={16} color={Colors.white} style={{ marginLeft: 8 }} />
              </Pressable>
            </Animated.View>
          )}

          {/* Album dropdown overlay */}
          {isAlbumDropdownOpen && activeTab === "Gallery" && (
            <View style={styles.albumDropdownOverlay}>
              <Pressable
                style={styles.albumDropdownItem}
                onPress={() => {
                  setSelectedAlbum(null);
                  setIsAlbumDropdownOpen(false);
                }}
              >
                <Text style={[styles.albumDropdownItemText, selectedAlbum === null && styles.albumDropdownItemTextActive]}>
                  Recents
                </Text>
                {selectedAlbum === null && (
                  <Ionicons name="checkmark" size={16} color={Colors.primary} />
                )}
              </Pressable>
              {albums.map(album => (
                <Pressable
                  key={album.id}
                  style={styles.albumDropdownItem}
                  onPress={() => {
                    setSelectedAlbum(album);
                    setIsAlbumDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.albumDropdownItemText, selectedAlbum?.id === album.id && styles.albumDropdownItemTextActive]}>
                    {album.title}
                    <Text style={styles.albumDropdownItemCount}>{album.assetCount !== undefined ? `  ${album.assetCount}` : ""}</Text>
                  </Text>
                  {selectedAlbum?.id === album.id && (
                    <Ionicons name="checkmark" size={16} color={Colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Full-screen preview — rendered inside the Modal so it stacks correctly on iOS */}
        {previewAsset !== null && (
          <View style={[styles.previewContainer, { paddingBottom: Math.max(insets.bottom, 16) + 64 }]}>
            {/* Header */}
            <Reanimated.View
              style={[styles.previewHeader, { paddingTop: insets.top + 8 }, headerAnimatedStyle]}
              pointerEvents={editorMode !== "none" ? "none" : "box-none"}
            >
              <Text style={styles.previewContactName} numberOfLines={1}>
                {contactName}
              </Text>
              <Pressable
                style={styles.previewSelectCircleWrapper}
                onPress={() => previewAsset && toggleSelection(previewAsset.uri)}
              >
                <View style={[styles.previewSelectCircle, isPreviewSelected && styles.previewSelectCircleFilled]}>
                  {isPreviewSelected && <Ionicons name="checkmark" size={18} color={Colors.white} />}
                </View>
              </Pressable>
            </Reanimated.View>

            <Reanimated.View style={[styles.animatedPreviewWrapper, animatedPreviewStyle]}>
              {/* Image with Skia Canvas */}
              <View
                ref={canvasContainerRef}
                style={styles.previewImageContainer}
                onLayout={handleCanvasContainerLayout}
              >
              {/* Base image — always visible to prevent blink while Skia loads */}
              <Image
                source={workingUri ?? previewAsset.uri}
                style={[styles.previewImage, isSkiaReady && { opacity: 0 }]}
                contentFit="contain"
              />
              {/* Skia canvas overlay — renders on top once URI is resolved */}
              {canvasLayout.width > 0 && canvasLayout.height > 0 && (workingUri ?? resolvedUri) && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <ImageEditorCanvas
                    ref={editorCanvasRef}
                    imageUri={workingUri ?? resolvedUri!}
                    filterValues={filterValues}
                    paths={drawingPaths}
                    currentPath={currentPath}
                    canvasWidth={canvasLayout.width}
                    canvasHeight={canvasLayout.height}
                    onReady={handleSkiaReady}
                  />
                </View>
              )}

              {/* Touch responder overlay for painting — only active in paint mode */}
              {editorMode === "paint" && (
                <View
                  style={StyleSheet.absoluteFill}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={e => {
                    const { locationX, locationY } = e.nativeEvent;
                    handlePaintTouchStart(locationX, locationY);
                  }}
                  onResponderMove={e => {
                    const { locationX, locationY } = e.nativeEvent;
                    handlePaintTouchMove(locationX, locationY);
                  }}
                  onResponderRelease={handlePaintTouchEnd}
                />
              )}
            </View>

            {/* Crop overlay */}
            {editorMode === "crop" && imageLayout.width > 0 && (
              <CropOverlay
                imageLayout={imageLayout}
                translateY={EDIT_MODE_TRANSLATE_Y}
                onApply={handleCropApply}
                onCancel={handleCropCancel}
              />
            )}
            </Reanimated.View>

            {/* Editor tools area — hidden during crop mode (crop has its own buttons) */}
            {editorMode !== "crop" && (
              <View style={[styles.previewEditorArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                
                <Reanimated.View 
                  style={[styles.toolsPanel, toolsAnimatedStyle]} 
                  pointerEvents={isToolsActive ? "auto" : "none"}
                >
                  {/* Paint toolbar */}
                  {renderTool === "paint" && (
                    <PaintToolbar
                      selectedColor={paintColor}
                      selectedBrushSize={brushSize}
                      isEraserActive={isEraserActive}
                      paths={drawingPaths}
                      onColorChange={c => {
                        setPaintColor(c);
                        setIsEraserActive(false);
                      }}
                      onBrushSizeChange={setBrushSize}
                      onEraserToggle={handleEraserToggle}
                      onUndo={handlePaintUndo}
                    />
                  )}

                  {/* Filters panel */}
                  {renderTool === "filters" && (
                    <FiltersPanel
                      values={filterValues}
                      onValueChange={handleFilterChange}
                      onReset={handleFilterReset}
                    />
                  )}
                </Reanimated.View>

                {/* Footer buttons */}
                <View style={styles.previewFooter}>
                  <Pressable style={styles.previewBackButton} onPress={handleBackFromPreview}>
                    <Ionicons name="arrow-back" size={24} color={Colors.white} />
                  </Pressable>

                  {/* Editor toolbar (Crop / Paint / Filters) */}
                  <EditorToolbar
                    activeMode={editorMode}
                    onModeChange={setEditorMode}
                  />

                  <Pressable style={styles.previewSendButton} onPress={handleSendPreview}>
                    <Text style={styles.previewSendText}>
                      {selectedUris.size > 1 ? `Send ${selectedUris.size} Photos` : "Send"}
                    </Text>
                    <Ionicons name="send" size={18} color={Colors.white} style={{ marginLeft: 8 }} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ─── Bottom Sheet ───────────────────────────────────────────────────────
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bottomSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: height * 0.5,
    maxHeight: height * 0.85,
  },
  sheetHeader: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  dragHandleRow: {
    alignItems: "center",
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    width: "100%",
  },
  sheetHeaderClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  sheetHeaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeaderSpacer: {
    width: 40,
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  albumPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.border,
    alignSelf: "center",
  },
  albumPickerText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  albumDropdownOverlay: {
    position: "absolute",
    top: 96, // below the taller header
    left: 16,
    right: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 50,
    maxHeight: 280,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  albumDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  albumDropdownItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
  },
  albumDropdownItemTextActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  albumDropdownItemCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  contentContainer: {
    height: height * 0.5,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: `${Colors.primary}15`,
  },
  tabText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: "600",
  },

  // ─── Gallery ────────────────────────────────────────────────────────────
  galleryContainer: {
    flex: 1,
  },
  galleryContent: {
    paddingBottom: 20,
  },
  galleryItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginBottom: ITEM_MARGIN,
    marginRight: ITEM_MARGIN,
    backgroundColor: Colors.border,
    position: "relative",
  },
  galleryImage: {
    flex: 1,
  },
  selectedDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  selectCircleWrapper: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  selectCircleFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cameraItem: {
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraText: {
    color: Colors.white,
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: 16,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  sendButtonContainer: {
    position: "absolute",
    bottom: 88,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  sendButton: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },

  // ─── Full-screen Preview ────────────────────────────────────────────────
  previewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 100,
    flexDirection: "column",
  },
  animatedPreviewWrapper: {
    flex: 1,
    width: "100%",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  previewContactName: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  previewSelectCircleWrapper: {
    padding: 4,
  },
  previewSelectCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: Colors.white,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  previewSelectCircleFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  previewImageContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  previewImage: {
    flex: 1,
  },
  // ─── Editor Tools Area ──────────────────────────────────────────────────
  previewEditorArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
  },
  toolsPanel: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  previewBackButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewSendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  previewSendText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});

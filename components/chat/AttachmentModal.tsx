import { formatFileSize, getFileIconByMimeType } from "@/utils/fileHelpers";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Skia } from "@shopify/react-native-skia";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { getThumbnailAsync } from "expo-video-thumbnails";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import type { SelectedChatMedia } from "@/types/chatMedia";
import {
  getDownloadedMediaRecords,
  removeDownloadedMediaRecords,
  type DownloadedMediaRecord,
} from "@/utils/downloadedMediaStorage";
import { ensureUploadableLocalFileAsync, getUriWithoutHash } from "@/utils/ensureUploadableLocalFile";
import { VideoPreviewModal } from "./VideoPreviewModal";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const EDIT_MODE_SCALE = 1;
const EDIT_MODE_TRANSLATE_Y = -(SCREEN_HEIGHT * 0.11);
const ANIMATION_DURATION = 250;
const VIDEO_DURATION_MS_MULTIPLIER = 1000;
const VIDEO_THUMBNAIL_TIME_MS = 1000;
const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (width - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
const PAGE_SIZE = 60;
const GALLERY_SKELETON_ITEM_COUNT = 15;
const GALLERY_SKELETON_ITEMS = Array.from(
  { length: GALLERY_SKELETON_ITEM_COUNT },
  (_item, index) => `gallery-skeleton-${index}`,
);

type AttachmentModalProps = {
  visible: boolean;
  onClose: () => void;
  onSendMedia: (uris: string[]) => void;
  onSendVideo?: (video: SelectedChatMedia) => Promise<void> | void;
  contactName: string;
  galleryRefreshKey?: number;
  onSendFile?: (fileInfo: { name: string; uri: string; mimeType?: string; size?: number }) => void;
};

type RecentFile = {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  sentAt: number;
};

type TabType = "Gallery" | "File";

type GalleryVideoThumbnailProps = {
  asset: MediaLibrary.Asset;
};

type ResolvedDownloadedMediaAsset = {
  record: DownloadedMediaRecord;
  asset: MediaLibrary.Asset | null;
};

type GalleryAssetWithDisplayTime = {
  asset: MediaLibrary.Asset;
  displayTime: number;
};

function mergeGalleryAssetsByDisplayTime(
  normalAssets: MediaLibrary.Asset[],
  downloadedAssets: MediaLibrary.Asset[],
  downloadedRecords: DownloadedMediaRecord[],
): MediaLibrary.Asset[] {
  const recordsByAssetId = new Map(
    downloadedRecords.map(record => [record.assetId, record]),
  );
  const assetsById = new Map<string, MediaLibrary.Asset>();

  for (const asset of normalAssets) {
    assetsById.set(asset.id, asset);
  }

  for (const asset of downloadedAssets) {
    assetsById.set(asset.id, asset);
  }

  return Array.from(assetsById.values())
    .map((asset): GalleryAssetWithDisplayTime => {
      const downloadedRecord = recordsByAssetId.get(asset.id);

      return {
        asset,
        displayTime: downloadedRecord?.savedAt ?? asset.creationTime,
      };
    })
    .sort((a, b) => b.displayTime - a.displayTime)
    .map(item => item.asset);
}

const GalleryVideoThumbnail = ({ asset }: GalleryVideoThumbnailProps) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadThumbnail = async () => {
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
        const rawSourceUri = assetInfo.localUri ?? asset.uri;
        const sourceUri = getUriWithoutHash(rawSourceUri);

        const preparedVideo = await ensureUploadableLocalFileAsync({
          uri: sourceUri,
          fileName: asset.filename || `video-${asset.id}.mp4`,
          mimeType: DEFAULT_VIDEO_MIME_TYPE,
        });

        const result = await getThumbnailAsync(preparedVideo.uri, {
          time: VIDEO_THUMBNAIL_TIME_MS,
        });

        if (isMounted) {
          setThumbnailUri(result.uri);
        }
      } catch (error) {
        console.warn("[GalleryVideoThumbnail] Failed to create thumbnail", {
          assetId: asset.id,
          assetUri: asset.uri,
          error,
        });

        if (isMounted) {
          setThumbnailUri(null);
        }
      }
    };

    loadThumbnail();

    return () => {
      isMounted = false;
    };
  }, [asset.id, asset.uri, asset.filename]);

  return (
    <View style={styles.galleryVideoFallback}>
      {thumbnailUri ? (
        <Image source={thumbnailUri}  style={styles.galleryVideoThumbnail} contentFit="cover" />
      ) : (
        <View style={styles.galleryVideoPlaceholder} />
      )}

      <View style={styles.galleryVideoPlayOverlay}>
        <Ionicons name="play-circle" size={38} color={Colors.white} />
      </View>

      <View style={styles.galleryVideoDurationBadge}>
        <Text style={styles.galleryVideoDurationText}>
          {Math.floor(asset.duration / 60)}:
          {Math.floor(asset.duration % 60).toString().padStart(2, "0")}
        </Text>
      </View>
    </View>
  );
};

export const AttachmentModal = ({
  visible,
  onClose,
  onSendMedia,
  onSendVideo,
  contactName,
  galleryRefreshKey = 0,
  onSendFile,
}: AttachmentModalProps) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("Gallery");
  const [internalVisible, setInternalVisible] = useState(visible);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [downloadedMediaRecords, setDownloadedMediaRecords] = useState<DownloadedMediaRecord[]>([]);
  const [downloadedAssets, setDownloadedAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<MediaLibrary.Asset | null>(null);
  const [previewVideo, setPreviewVideo] = useState<SelectedChatMedia | null>(null);
  const [isPreparingVideo, setIsPreparingVideo] = useState(false);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(null);
  const [isAlbumDropdownOpen, setIsAlbumDropdownOpen] = useState(false);
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

  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const galleryAssets = useMemo(
    () => mergeGalleryAssetsByDisplayTime(assets, downloadedAssets, downloadedMediaRecords),
    [assets, downloadedAssets, downloadedMediaRecords],
  );

  useEffect(() => {
    if (activeTab === "File") {
      loadRecentFiles();
    }
  }, [activeTab]);

  const loadRecentFiles = async () => {
    try {
      const data = await AsyncStorage.getItem("recent_sent_files");

      if (data) {
        setRecentFiles(JSON.parse(data));
      }
    } catch (e) {
      console.error("Failed to load recent files", e);
    }
  };

  const saveRecentFile = async (file: RecentFile) => {
    try {
      const updated = [file, ...recentFiles.filter(f => f.uri !== file.uri)].slice(0, 10);
      setRecentFiles(updated);
      await AsyncStorage.setItem("recent_sent_files", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save recent file", e);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileInfo = {
          id: Date.now().toString(),
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.size,
          sentAt: Date.now(),
        };

        saveRecentFile(fileInfo);

        if (onSendFile) {
          onSendFile(fileInfo);
        }
        onClose();
      }
    } catch (e) {
      console.error("Error picking file", e);
    }
  };

  const handleSendRecentFile = (file: RecentFile) => {
    saveRecentFile({ ...file, sentAt: Date.now() });
    if (onSendFile) {
      onSendFile(file);
    }
    onClose();
  };

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
        setPreviewVideo(null);
        setIsPreparingVideo(false);
        resetEditorState();
        dragY.setValue(0);
        setInternalVisible(false);
      });
    }
  }, [visible, internalVisible]);

  const loadDownloadedMediaAssets = useCallback(async (): Promise<void> => {
    try {
      const records = await getDownloadedMediaRecords();
      const resolvedAssets = await Promise.all(
        records.map(async (record): Promise<ResolvedDownloadedMediaAsset> => {
          try {
            const asset = await MediaLibrary.getAssetInfoAsync(record.assetId);

            return {
              record,
              asset,
            };
          } catch {
            return {
              record,
              asset: null,
            };
          }
        }),
      );
      const missingAssetIds: string[] = [];
      const loadedRecords: DownloadedMediaRecord[] = [];
      const loadedAssets: MediaLibrary.Asset[] = [];

      for (const item of resolvedAssets) {
        if (item.asset) {
          loadedRecords.push(item.record);
          loadedAssets.push(item.asset);
        } else {
          missingAssetIds.push(item.record.assetId);
        }
      }

      if (missingAssetIds.length > 0) {
        try {
          await removeDownloadedMediaRecords(missingAssetIds);
        } catch (error) {
          console.warn("Failed to remove missing downloaded media records", error);
        }
      }

      setDownloadedMediaRecords(loadedRecords);
      setDownloadedAssets(loadedAssets);
    } catch (error) {
      console.error("Failed to load downloaded media records", error);
      setDownloadedMediaRecords([]);
      setDownloadedAssets([]);
    }
  }, []);

  const fetchPhotos = useCallback(async (album: MediaLibrary.Album | null = selectedAlbum) => {
    setIsLoading(true);
    setAssets([]);
    setEndCursor(undefined);
    setHasNextPage(true);

    try {
      const [result] = await Promise.all([
        MediaLibrary.getAssetsAsync({
          mediaType: ["photo", "video"],
          first: PAGE_SIZE,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          ...(album ? { album: album.id } : {}),
        }),
        loadDownloadedMediaAssets(),
      ]);

      setAssets(result.assets);
      setEndCursor(result.endCursor);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      console.error("Failed to fetch photos", error);
    } finally {
      setIsLoading(false);
    }
  }, [loadDownloadedMediaAssets, selectedAlbum]);

  const requestMediaPermissions = async () => {
    setIsLoading(true);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
      const isGranted = status === "granted";

      setHasPermission(isGranted);

      if (isGranted) {
        fetchPhotos(null);
        MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
          .then(result => setAlbums(result))
          .catch(console.error);
        return;
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to request media permissions", error);
      setHasPermission(false);
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
  }, [fetchPhotos, hasPermission, selectedAlbum]);

  useEffect(() => {
    if (visible && hasPermission && activeTab === "Gallery") {
      fetchPhotos(selectedAlbum);
    }
  }, [activeTab, fetchPhotos, galleryRefreshKey, hasPermission, selectedAlbum, visible]);

  const fetchMorePhotos = async () => {
    if (isLoadingMore || !hasNextPage || !endCursor) return;
    setIsLoadingMore(true);

    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: ["photo", "video"],
        first: PAGE_SIZE,
        after: endCursor,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
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

  const getLocalFileSize = useCallback((uri: string): number | undefined => {
    try {
      const file = new FileSystem.File(uri);
      const info = file.info();
      return info.exists ? info.size : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const handleOpenVideoPreview = useCallback(async (asset: MediaLibrary.Asset) => {
    try {
      setIsPreparingVideo(true);
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);
      const sourceUri = info.localUri ?? asset.uri;
      const sourceUriWithoutHash = getUriWithoutHash(sourceUri);

      const uploadableVideo = await ensureUploadableLocalFileAsync({
        uri: sourceUriWithoutHash,
        fileName: asset.filename,
        mimeType: DEFAULT_VIDEO_MIME_TYPE,
      });

      setPreviewVideo({
        uri: uploadableVideo.uri,
        type: "video",
        fileName: uploadableVideo.fileName,
        mimeType: uploadableVideo.mimeType,
        width: asset.width,
        height: asset.height,
        duration: Math.round(asset.duration * VIDEO_DURATION_MS_MULTIPLIER),
        fileSize: uploadableVideo.size ?? getLocalFileSize(uploadableVideo.uri),
      });
    } catch (error) {
      console.error("Failed to prepare video preview", error);
      Alert.alert("Video Error", "Could not prepare this video for preview.");
    } finally {
      setIsPreparingVideo(false);
    }
  }, [getLocalFileSize]);

  const handleSendVideoPreview = useCallback(
    async (video: SelectedChatMedia) => {
      if (!onSendVideo) {
        return;
      }

      await onSendVideo(video);
      setPreviewVideo(null);
      onClose();
    },
    [onClose, onSendVideo],
  );

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

    const isVideo = item.mediaType === "video";
    const isSelected = selectedUris.has(item.uri);

    return (
      <Pressable
        style={styles.galleryItem}
        onPress={() => {
          if (isVideo) {
            handleOpenVideoPreview(item);
            return;
          }

          setPreviewAsset(item);
        }}
      >
        {isVideo ? (
          <GalleryVideoThumbnail asset={item} />
        ) : (
          <Image source={item.uri} style={styles.galleryImage} contentFit="cover" />
        )}
        {isSelected && <View style={styles.selectedDimOverlay} />}
        {/* Select circle — top-right corner */}
        {!isVideo && (
          <Pressable
            style={styles.selectCircleWrapper}
            onPress={() => toggleSelection(item.uri)}
            hitSlop={8}
          >
            <View style={[styles.selectCircle, isSelected && styles.selectCircleFilled]}>
              {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
          </Pressable>
        )}
      </Pressable>
    );
  };

  // ─── Gallery ──────────────────────────────────────────────────────────────
  const renderGallerySkeleton = () => (
    <View style={styles.galleryContainer}>
      <View style={styles.gallerySkeletonGrid}>
        {GALLERY_SKELETON_ITEMS.map((item, index) => (
          <View
            key={item}
            style={[
              styles.gallerySkeletonItem,
              (index + 1) % COLUMN_COUNT === 0 && styles.gallerySkeletonItemEndOfRow,
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderGallery = () => {
    if (hasPermission === null || (isLoading && galleryAssets.length === 0)) {
      return renderGallerySkeleton();
    }

    if (!hasPermission) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Photo library permission is required to view and send photos and videos.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestMediaPermissions}>
            <Text style={styles.permissionButtonText}>Allow Access</Text>
          </Pressable>
        </View>
      );
    }

    const data: (MediaLibrary.Asset | "camera")[] = ["camera", ...galleryAssets];

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
  const renderFiles = () => {
    return (
      <View style={styles.filesContainer}>
        <View style={styles.filesHeader}>
          <Pressable style={styles.chooseFileButton} onPress={handlePickFile}>
            <Ionicons name="document-text" size={24} color={Colors.white} style={styles.chooseFileIcon} />
            <Text style={styles.chooseFileText}>Choose from Files</Text>
          </Pressable>
        </View>

        <Text style={styles.recentFilesTitle}>Recently sent</Text>

        {recentFiles.length === 0 ? (
          <View style={styles.emptyRecentContainer}>
            <Ionicons name="time-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyRecentText}>No recently sent files</Text>
          </View>
        ) : (
          <FlatList
            data={recentFiles}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.recentFileRow} onPress={() => handleSendRecentFile(item)}>
                <View style={styles.recentFileIconContainer}>
                  <Ionicons name={getFileIconByMimeType(item.mimeType, item.name)} size={24} color={Colors.white} />
                </View>
                <View style={styles.recentFileDetails}>
                  <Text style={styles.recentFileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.recentFileSize}>{formatFileSize(item.size)}</Text>
                </View>
              </Pressable>
            )}
            contentContainerStyle={styles.recentFilesList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

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
                ) : null}
              </View>

              {/* Right: spacer to balance the close button */}
              <View style={styles.sheetHeaderSpacer} />
            </View>
          </View>

          <View style={styles.contentContainer}>
            {activeTab === "Gallery" && renderGallery()}
            {activeTab === "File" && renderFiles()}
          </View>

          <View style={styles.tabBar}>
            {(["Gallery", "File"] as const).map(tab => {
              const iconMap: Record<TabType, keyof typeof Ionicons.glyphMap> = {
                Gallery: "image",
                File: "document",
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

        {isPreparingVideo && (
          <View style={styles.videoPreparingOverlay}>
            <ActivityIndicator size="large" color={Colors.white} />
          </View>
        )}

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

        <VideoPreviewModal
          visible={previewVideo !== null}
          video={previewVideo}
          title={contactName}
          showTrimControls
          autoPlay={false}
          showSendButton
          onClose={() => setPreviewVideo(null)}
          onSend={onSendVideo ? handleSendVideoPreview : undefined}
        />
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
  videoPreparingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
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
  gallerySkeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },
  gallerySkeletonItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginBottom: ITEM_MARGIN,
    marginRight: ITEM_MARGIN,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  gallerySkeletonItemEndOfRow: {
    marginRight: 0,
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
  galleryVideoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  galleryVideoThumbnail: {
  ...StyleSheet.absoluteFillObject,
},
  galleryVideoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#263244",
  },
  galleryVideoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  galleryVideoDurationBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  galleryVideoDurationText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: "700",
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
  filesContainer: {
    flex: 1,
    paddingTop: 16,
  },
  filesHeader: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  chooseFileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  chooseFileIcon: {
    marginRight: 8,
  },
  chooseFileText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  recentFilesTitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recentFilesList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  recentFileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  recentFileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recentFileDetails: {
    flex: 1,
    justifyContent: "center",
  },
  recentFileName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  recentFileSize: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  emptyRecentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyRecentText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
  },
});

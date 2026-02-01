import { useState, useRef, useEffect } from 'react';
import './Layout.css';
import { getContrastingBackground } from '../utils/colorUtils';
import { uploadAndCreateLayout } from '../services/api';

const RATIO_OPTIONS = [
  { label: 'Fit All', value: 'fit-all' },
  { label: 'Original', value: 'original' },
  { label: '4:5', value: '4:5' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '3:2', value: '3:2' },
  { label: '21:9', value: '21:9' },
];

const LAYOUT_TYPES = {
  TWO_HORIZONTAL: { label: 'Side by Side', value: '2-horizontal', imageCount: 2 },
  TWO_VERTICAL: { label: 'Top & Bottom', value: '2-vertical', imageCount: 2 },
  THREE_ROW: { label: '3 in a Row', value: '3-row', imageCount: 3 },
  THREE_COLUMN: { label: '3 in a Column', value: '3-column', imageCount: 3 },
  THREE_LEFT: { label: '1 Left + 2 Right', value: '3-left', imageCount: 3 },
  THREE_RIGHT: { label: '2 Left + 1 Right', value: '3-right', imageCount: 3 },
};

function Layout() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [layoutType, setLayoutType] = useState('2-horizontal');
  const [ratio, setRatio] = useState('fit-all');
  const [color, setColor] = useState('#FFFFFF');
  const [imageSettings, setImageSettings] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ stage: '', progress: 0 });
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const dragCounterRef = useRef(0);
  const errorTimeoutRef = useRef(null);

  const maxImages = LAYOUT_TYPES[Object.keys(LAYOUT_TYPES).find(k => LAYOUT_TYPES[k].value === layoutType)]?.imageCount || 2;

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }

      // Set new timeout
      errorTimeoutRef.current = setTimeout(() => {
        setError(null);
      }, 5000);

      // Cleanup
      return () => {
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
        }
      };
    }
  }, [error]);

  // Initialize image settings when files change
  useEffect(() => {
    if (selectedFiles.length > 0) {
      setImageSettings(selectedFiles.map((file, index) => ({
        id: file.id,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      })));
    } else {
      setImageSettings([]);
    }
  }, [selectedFiles]);

  // Generate preview when settings change (debounced)
  useEffect(() => {
    if (selectedFiles.length >= 2) {
      // Debounce: only generate after 300ms of no changes
      const timeoutId = setTimeout(() => {
        generatePreview();
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFiles, layoutType, ratio, color, imageSettings]);

  const validateFile = (file) => {
    if (!file.type.match('image/(jpeg|jpg|png)')) {
      return { valid: false, error: 'Invalid file type (JPEG or PNG only)' };
    }
    return { valid: true };
  };

  const addFiles = (files) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - selectedFiles.length;

    if (remainingSlots <= 0) {
      setError(`This layout supports maximum ${maxImages} images`);
      return;
    }

    const filesToAdd = fileArray.slice(0, remainingSlots);
    const validFiles = [];
    const errors = [];

    filesToAdd.forEach((file) => {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file: file,
          name: file.name,
          size: file.size,
        });
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setError(null);
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (filesToAdd.length < fileArray.length) {
      setError(`Only first ${remainingSlots} images were added (max ${maxImages})`);
    }
  };

  const handleFileSelect = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  };

  const handleUploadAreaClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow drag if max images reached
    if (selectedFiles.length >= maxImages) return;

    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedFiles.length >= maxImages) return;

    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow drag if max images reached
    if (selectedFiles.length >= maxImages) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    // Don't allow drop if max images reached
    if (selectedFiles.length >= maxImages) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  };

  const handleRemoveFile = (fileId) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setError(null);
  };

  const handleLayoutChange = (newLayout) => {
    setLayoutType(newLayout);
    const newMaxImages = LAYOUT_TYPES[Object.keys(LAYOUT_TYPES).find(k => LAYOUT_TYPES[k].value === newLayout)]?.imageCount || 2;
    if (selectedFiles.length > newMaxImages) {
      setSelectedFiles((prev) => prev.slice(0, newMaxImages));
    }
  };

  const handleZoomChange = (fileId, zoom) => {
    setImageSettings((prev) =>
      prev.map((setting) =>
        setting.id === fileId ? { ...setting, zoom: parseFloat(zoom) } : setting
      )
    );
  };

  const loadImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const calculateFitAllDimensions = (images, layout) => {
    if (images.length === 0) return { width: 1200, height: 1200 };

    // Giới hạn kích thước tối đa để tránh canvas quá lớn
    const MAX_DIMENSION = 2000;

    let finalWidth, finalHeight;

    switch (layout) {
      case '2-horizontal': {
        // Side by side - add widths, use max height
        // Assume each image has height = 1000, scale proportionally
        const baseHeight = 1000;

        // Calculate width of each image when scaled to baseHeight
        const img1Width = (images[0].width / images[0].height) * baseHeight;
        const img2Width = (images[1].width / images[1].height) * baseHeight;

        // Total width
        finalWidth = img1Width + img2Width;
        finalHeight = baseHeight;
        break;
      }

      case '2-vertical': {
        // Top and bottom - use max width, add heights
        // Assume each image has width = 1000, scale proportionally
        const baseWidth = 1000;

        // Calculate height of each image when scaled to baseWidth
        const img1Height = (images[0].height / images[0].width) * baseWidth;
        const img2Height = (images[1].height / images[1].width) * baseWidth;

        // Total height
        finalWidth = baseWidth;
        finalHeight = img1Height + img2Height;
        break;
      }

      case '3-row': {
        // 3 ảnh nằm ngang - cộng chiều rộng
        const baseHeight = 1000;

        finalWidth = images.reduce((sum, img) => {
          return sum + (img.width / img.height) * baseHeight;
        }, 0);
        finalHeight = baseHeight;
        break;
      }

      case '3-column': {
        // 3 ảnh xếp dọc - cộng chiều cao
        const baseWidth = 1000;

        finalHeight = images.reduce((sum, img) => {
          return sum + (img.height / img.width) * baseWidth;
        }, 0);
        finalWidth = baseWidth;
        break;
      }

      case '3-left': {
        // 1 ảnh bên trái (chiếm 50% width), 2 ảnh bên phải xếp dọc (mỗi ảnh 50% width)
        const leftImg = images[0];
        const rightImg1 = images[1];
        const rightImg2 = images[2];

        // Giả sử width mỗi cell = 500
        const cellWidth = 500;

        // Chiều cao ảnh trái nếu width = cellWidth
        const leftHeight = (leftImg.height / leftImg.width) * cellWidth;

        // Chiều cao mỗi ảnh phải nếu width = cellWidth
        const right1Height = rightImg1 ? (rightImg1.height / rightImg1.width) * cellWidth : 0;
        const right2Height = rightImg2 ? (rightImg2.height / rightImg2.width) * cellWidth : 0;
        const rightTotalHeight = right1Height + right2Height;

        // Lấy chiều cao lớn nhất
        finalWidth = cellWidth * 2;
        finalHeight = Math.max(leftHeight, rightTotalHeight);
        break;
      }

      case '3-right': {
        // 2 ảnh bên trái xếp dọc (mỗi ảnh 50% width), 1 ảnh bên phải (chiếm 50% width)
        const leftImg1 = images[0];
        const leftImg2 = images[1];
        const rightImg = images[2];

        const cellWidth = 500;

        // Chiều cao mỗi ảnh trái
        const left1Height = leftImg1 ? (leftImg1.height / leftImg1.width) * cellWidth : 0;
        const left2Height = leftImg2 ? (leftImg2.height / leftImg2.width) * cellWidth : 0;
        const leftTotalHeight = left1Height + left2Height;

        // Chiều cao ảnh phải
        const rightHeight = (rightImg.height / rightImg.width) * cellWidth;

        // Lấy chiều cao lớn nhất
        finalWidth = cellWidth * 2;
        finalHeight = Math.max(leftTotalHeight, rightHeight);
        break;
      }

      default:
        finalWidth = 1200;
        finalHeight = 1200;
    }

    // Giới hạn kích thước tối đa
    if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / finalWidth, MAX_DIMENSION / finalHeight);
      finalWidth = Math.round(finalWidth * scale);
      finalHeight = Math.round(finalHeight * scale);
    }

    return {
      width: Math.round(finalWidth),
      height: Math.round(finalHeight)
    };
  };

  const generatePreview = async () => {
    if (selectedFiles.length < 2) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Load all images
      const images = await Promise.all(
        selectedFiles.map((fileObj) => loadImage(fileObj.file))
      );

      // Calculate canvas dimensions based on ratio
      let canvasWidth = 1200;
      let canvasHeight = 1200;

      if (ratio === 'fit-all') {
        // Calculate dimensions to fit all images without cropping
        const layoutDims = calculateFitAllDimensions(images, layoutType);
        canvasWidth = layoutDims.width;
        canvasHeight = layoutDims.height;
      } else if (ratio !== 'original') {
        const [w, h] = ratio.split(':').map(Number);
        canvasHeight = Math.round((canvasWidth * h) / w);
      }

      // Downscale for preview (max 600px width to prevent memory issues)
      const MAX_PREVIEW_WIDTH = 600;
      let scale = 1;
      if (canvasWidth > MAX_PREVIEW_WIDTH) {
        scale = MAX_PREVIEW_WIDTH / canvasWidth;
        canvasWidth = Math.round(canvasWidth * scale);
        canvasHeight = Math.round(canvasHeight * scale);
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Fill background
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw images based on layout (with scale applied)
      drawLayout(ctx, images, canvasWidth, canvasHeight);

      // Convert to preview (lower quality for faster rendering)
      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      setPreviewUrl(previewDataUrl);
    } catch (err) {
      console.error('Failed to generate preview:', err);
      setError('Failed to generate preview');
    }
  };

  const drawLayout = (ctx, images, canvasWidth, canvasHeight) => {
    const settings = imageSettings;

    switch (layoutType) {
      case '2-horizontal': {
        const cellWidth = canvasWidth / 2;
        images.slice(0, 2).forEach((img, idx) => {
          const setting = settings[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, img, idx * cellWidth, 0, cellWidth, canvasHeight, setting);
        });
        break;
      }
      case '2-vertical': {
        const cellHeight = canvasHeight / 2;
        images.slice(0, 2).forEach((img, idx) => {
          const setting = settings[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, img, 0, idx * cellHeight, canvasWidth, cellHeight, setting);
        });
        break;
      }
      case '3-row': {
        const cellWidth = canvasWidth / 3;
        images.slice(0, 3).forEach((img, idx) => {
          const setting = settings[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, img, idx * cellWidth, 0, cellWidth, canvasHeight, setting);
        });
        break;
      }
      case '3-column': {
        const cellHeight = canvasHeight / 3;
        images.slice(0, 3).forEach((img, idx) => {
          const setting = settings[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, img, 0, idx * cellHeight, canvasWidth, cellHeight, setting);
        });
        break;
      }
      case '3-left': {
        // 1 image on left half, 2 stacked on right half
        const leftWidth = canvasWidth / 2;
        const rightWidth = canvasWidth / 2;
        const rightHeight = canvasHeight / 2;

        if (images[0]) {
          const setting = settings[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, images[0], 0, 0, leftWidth, canvasHeight, setting);
        }
        if (images[1]) {
          const setting = settings[1] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, images[1], leftWidth, 0, rightWidth, rightHeight, setting);
        }
        if (images[2]) {
          const setting = settings[2] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, images[2], leftWidth, rightHeight, rightWidth, rightHeight, setting);
        }
        break;
      }
      case '3-right': {
        // 2 stacked on left half, 1 on right half
        const leftWidth = canvasWidth / 2;
        const leftHeight = canvasHeight / 2;
        const rightWidth = canvasWidth / 2;

        if (images[0]) {
          const setting = settings[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, images[0], 0, 0, leftWidth, leftHeight, setting);
        }
        if (images[1]) {
          const setting = settings[1] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, images[1], 0, leftHeight, leftWidth, leftHeight, setting);
        }
        if (images[2]) {
          const setting = settings[2] || { zoom: 1, offsetX: 0, offsetY: 0 };
          drawImageInCell(ctx, images[2], leftWidth, 0, rightWidth, canvasHeight, setting);
        }
        break;
      }
    }
  };

  const drawImageInCell = (ctx, img, x, y, width, height, setting) => {
    const { zoom, offsetX, offsetY } = setting;

    // Calculate scaled dimensions
    const scale = Math.max(width / img.width, height / img.height) * zoom;
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Center the image
    const drawX = x + (width - scaledWidth) / 2 + offsetX;
    const drawY = y + (height - scaledHeight) / 2 + offsetY;

    // Clip to cell boundaries
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // Draw image
    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
    ctx.restore();
  };

  const generateFullSizeLayout = async () => {
    if (selectedFiles.length < 2) return null;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Load all images
      const images = await Promise.all(
        selectedFiles.map((fileObj) => loadImage(fileObj.file))
      );

      // Calculate canvas dimensions based on ratio (FULL SIZE)
      let canvasWidth = 1200;
      let canvasHeight = 1200;

      if (ratio === 'fit-all') {
        const layoutDims = calculateFitAllDimensions(images, layoutType);
        canvasWidth = layoutDims.width;
        canvasHeight = layoutDims.height;
      } else if (ratio !== 'original') {
        const [w, h] = ratio.split(':').map(Number);
        canvasHeight = Math.round((canvasWidth * h) / w);
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Fill background
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw images based on layout
      drawLayout(ctx, images, canvasWidth, canvasHeight);

      // Convert to full size image
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (err) {
      console.error('Failed to generate full size layout:', err);
      return null;
    }
  };

  const handleDownload = async () => {
    if (selectedFiles.length < 2) {
      setError('Please add at least 2 images');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Prepare files array
      const files = selectedFiles.map(f => f.file);

      // Load images to get dimensions for fit-all
      const images = await Promise.all(
        files.map((file) => loadImage(file))
      );

      // Calculate dimensions
      let dimensions = null;
      if (ratio === 'fit-all') {
        dimensions = calculateFitAllDimensions(images, layoutType);
      } else if (ratio !== 'original') {
        const [w, h] = ratio.split(':').map(Number);
        dimensions = {
          width: 1200,
          height: Math.round((1200 * h) / w)
        };
      } else {
        dimensions = { width: 1200, height: 1200 };
      }

      // Prepare layout config
      const layoutConfig = {
        layoutType: layoutType,
        ratio: ratio,
        backgroundColor: color,
        dimensions: dimensions
      };

      // Prepare image settings with proper index
      const settings = selectedFiles.map((fileObj, index) => {
        const setting = imageSettings.find(s => s.id === fileObj.id) || {};
        return {
          index: index,
          zoom: setting.zoom || 1.0,
          offsetX: setting.offsetX || 0,
          offsetY: setting.offsetY || 0,
        };
      });

      // Upload and process on server
      const result = await uploadAndCreateLayout(
        files,
        layoutConfig,
        settings,
        (progressData) => {
          setProcessingProgress(progressData);
        }
      );

      // Download the result
      if (result.downloadUrl) {
        const downloadUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${result.downloadUrl}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = result.filename || `layout_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setIsProcessing(false);
    } catch (err) {
      console.error('Download failed:', err);

      // More informative error messages
      let errorMessage = 'Failed to create layout. ';

      if (err.response) {
        // Server responded with error
        errorMessage += err.response.data?.message || err.response.data?.error || `Server error (${err.response.status})`;
      } else if (err.request) {
        // Request made but no response
        errorMessage += 'Cannot connect to server. Make sure the backend is running on ' + (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000');
      } else {
        // Other errors
        errorMessage += err.message || 'Unknown error occurred';
      }

      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setImageSettings([]);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="layout-container">
      {error && (
        <div className="error-section">
          <div className="error-header">
            <div className="error-title">Error</div>
            <button
              className="error-close"
              onClick={() => setError(null)}
              aria-label="Close error"
            >
              ×
            </button>
          </div>
          <div className="error-message">{error}</div>
        </div>
      )}

      <div className="layout-content">
        <div className="layout-controls-section">
          <div className="control-group">
            <label className="control-label">Layout Type</label>
            <div className="layout-buttons">
              {Object.values(LAYOUT_TYPES).map((layout) => (
                <button
                  key={layout.value}
                  className={`layout-button ${layoutType === layout.value ? 'active' : ''}`}
                  onClick={() => handleLayoutChange(layout.value)}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          </div>

          {selectedFiles.length < maxImages && (
            <div className="control-group">
              <label className="control-label">Upload Images</label>
              <div
                className={`upload-section ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="upload-area" onClick={handleUploadAreaClick}>
                  <div className="upload-icon">+</div>
                  <div className="upload-text">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length}/${maxImages} images - Add more`
                      : `Add ${maxImages} images`}
                  </div>
                  <div className="upload-hint">Click or Drop here</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="file-input"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleFileSelect}
                  />
                </div>
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="control-group">
              <label className="control-label">
                Selected Images ({selectedFiles.length}/{maxImages})
              </label>
              <div className="files-list">
                {selectedFiles.map((fileObj, index) => {
                  const setting = imageSettings.find((s) => s.id === fileObj.id) || { zoom: 1 };
                  return (
                    <div key={fileObj.id} className="file-item">
                      <div className="file-item-header">
                        <div className="file-item-name">
                          {index + 1}. {fileObj.name}
                        </div>
                        <button
                          className="file-item-remove"
                          onClick={() => handleRemoveFile(fileObj.id)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                      <div className="file-item-controls">
                        <label className="zoom-label">
                          Zoom: {setting.zoom.toFixed(1)}x
                        </label>
                        <input
                          type="range"
                          className="zoom-slider"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={setting.zoom}
                          onChange={(e) => handleZoomChange(fileObj.id, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="control-group">
            <label className="control-label">Aspect Ratio</label>
            <div className="ratio-buttons">
              {RATIO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`ratio-button ${ratio === option.value ? 'active' : ''}`}
                  onClick={() => setRatio(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Background Color</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                className="color-input"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <span className="color-hex">{color.toUpperCase()}</span>
            </div>
          </div>

          <div className="control-group">
            <div className="action-buttons">
              <button
                className="download-button"
                onClick={handleDownload}
                disabled={!previewUrl || isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Download'}
              </button>
              <button
                className="reset-button"
                onClick={handleReset}
                disabled={isProcessing}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="layout-preview-section">
          <h3 className="preview-title">Preview</h3>
          {previewUrl ? (
            <div
              className="preview-container"
              style={{ backgroundColor: getContrastingBackground(color) }}
            >
              <img src={previewUrl} alt="Layout preview" className="preview-image" />
            </div>
          ) : (
            <div className="preview-placeholder">
              <div className="preview-placeholder-icon">+</div>
              <div className="preview-placeholder-text">
                {selectedFiles.length === 0
                  ? `Add ${maxImages} images to see preview`
                  : `Add ${maxImages - selectedFiles.length} more image(s)`}
              </div>
            </div>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-modal">
            <div className="processing-icon">⟳</div>
            <h3 className="processing-title">Creating Your Layout...</h3>

            <div className="processing-stage">
              {processingProgress.stage || 'Preparing...'}
            </div>

            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${processingProgress.progress || 0}%` }}
              />
            </div>

            <div className="progress-percentage">
              {Math.round(processingProgress.progress || 0)}%
            </div>

            {processingProgress.currentFile && processingProgress.totalFiles && (
              <div className="processing-file-info">
                Processing image {processingProgress.currentFile} of {processingProgress.totalFiles}
              </div>
            )}

            <div className="processing-hint">
              This may take a few moments...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;

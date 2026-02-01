import { useState, useRef, useEffect } from 'react';
import './NoCrop.css';
import { uploadAndProcessImage, getDownloadUrl } from '../services/api';
import { createImagePreview } from '../utils/imagePreview';
import { getContrastingBackground } from '../utils/colorUtils';

const RATIO_OPTIONS = [
  { label: 'Original', value: 'original' },
  { label: '4:5 (Instagram)', value: '4:5' },
  { label: '1:1 (Square)', value: '1:1' },
  { label: '16:9 (Widescreen)', value: '16:9' },
  { label: '3:2', value: '3:2' },
  { label: '21:9', value: '21:9' },
];

const MAX_IMAGES = parseInt(import.meta.env.VITE_MAX_IMAGES) || 5;

function NoCrop() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [ratio, setRatio] = useState('4:5');
  const [color, setColor] = useState('#000000');
  const [tempColor, setTempColor] = useState('#000000');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Generate previews when files, ratio, or color changes
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviews([]);
      return;
    }

    const generatePreviews = async () => {
      const newPreviews = await Promise.all(
        selectedFiles.map(async (fileObj) => {
          try {
            const preview = await createImagePreview(fileObj.file, ratio, color);
            return { id: fileObj.id, url: preview, status: 'ready' };
          } catch (err) {
            console.error('Failed to generate preview:', err);
            return { id: fileObj.id, url: null, status: 'error' };
          }
        })
      );
      setPreviews(newPreviews);
    };

    generatePreviews();
  }, [selectedFiles, ratio, color]);

  // Handler for color change (only update display, not trigger preview)
  const handleColorChange = (e) => {
    setTempColor(e.target.value);
  };

  // Handler for color input mouse up (update actual color and trigger preview)
  const handleColorCommit = (e) => {
    setColor(e.target.value);
  };

  const validateFile = (file) => {
    if (!file.type.match('image/(jpeg|jpg|png)')) {
      return { valid: false, error: 'Invalid file type (JPEG or PNG only)' };
    }
    return { valid: true };
  };

  const addFiles = (files) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_IMAGES - selectedFiles.length;
    
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
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
      setResults([]);
      setError(null);
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (filesToAdd.length < fileArray.length) {
      setError(`Only first ${remainingSlots} images were added (max ${MAX_IMAGES})`);
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
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);
    
    const progressArray = selectedFiles.map((f) => ({
      id: f.id,
      stage: 'waiting',
      progress: 0,
    }));
    setProcessingProgress(progressArray);

    const processedResults = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileObj = selectedFiles[i];
      
      try {
        // Update progress for current file
        setProcessingProgress((prev) =>
          prev.map((p) =>
            p.id === fileObj.id ? { ...p, stage: 'uploading', progress: 0 } : p
          )
        );

        const processResult = await uploadAndProcessImage(
          fileObj.file,
          ratio,
          color,
          (progressData) => {
            setProcessingProgress((prev) =>
              prev.map((p) =>
                p.id === fileObj.id
                  ? { ...p, stage: progressData.stage, progress: progressData.progress }
                  : p
              )
            );
          }
        );

        processedResults.push({
          id: fileObj.id,
          name: fileObj.name,
          result: processResult,
          status: 'success',
        });

        // Mark as completed
        setProcessingProgress((prev) =>
          prev.map((p) =>
            p.id === fileObj.id ? { ...p, stage: 'completed', progress: 100 } : p
          )
        );
      } catch (err) {
        console.error(`Error processing ${fileObj.name}:`, err);
        processedResults.push({
          id: fileObj.id,
          name: fileObj.name,
          error: err.message,
          status: 'error',
        });

        setProcessingProgress((prev) =>
          prev.map((p) =>
            p.id === fileObj.id ? { ...p, stage: 'error', progress: 0 } : p
          )
        );
      }
    }

    setResults(processedResults);
    setIsProcessing(false);
  };

  const handleDownload = (downloadUrl) => {
    if (downloadUrl) {
      // downloadUrl is already full path like "/api/process/download/507f1f77bcf86cd799439011"
      const fullUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${downloadUrl}`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = ''; // Let browser handle filename from Content-Disposition header
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAll = async () => {
    const successResults = results.filter((r) => r.status === 'success' && r.result?.downloadUrl);
    
    if (successResults.length === 0) return;

    // Download sequentially with delay to avoid browser blocking
    for (let i = 0; i < successResults.length; i++) {
      await new Promise((resolve) => {
        handleDownload(successResults[i].result.downloadUrl);
        // Wait 500ms between downloads
        setTimeout(resolve, 500);
      });
    }
  };

  const handleClearAll = () => {
    if (window.confirm(`Clear all ${results.length} processed images?`)) {
      setResults([]);
      setProcessingProgress([]);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setPreviews([]);
    setResults([]);
    setError(null);
    setProcessingProgress([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId, e) => {
    e.stopPropagation();
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setPreviews((prev) => prev.filter((p) => p.id !== fileId));
    setError(null);
  };

  const getProgressText = (stage, progress) => {
    if (stage === 'waiting') return 'Waiting...';
    if (stage === 'uploading') return `Uploading... ${progress}%`;
    if (stage === 'processing') return 'Processing...';
    if (stage === 'completed') return 'Completed!';
    if (stage === 'error') return 'Error!';
    return '';
  };

  return (
    <div className="app-container">
      <p className="app-subtitle">
        Add padding to your images without cropping (Max {MAX_IMAGES} images)
      </p>

      {error && (
        <div className="error-section">
          <div className="error-title">Error</div>
          <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
        </div>
      )}

      {results.length === 0 && (
        <>
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
                  ? `${selectedFiles.length} image(s) selected - Add more`
                  : 'Click or Drag & Drop Images'}
              </div>
              <div className="upload-hint">
                Supports JPEG and PNG • Max {MAX_IMAGES} images • Max 50MB per chunk
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="file-input"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                onChange={handleFileSelect}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="files-grid">
                {selectedFiles.map((fileObj) => {
                  const preview = previews.find((p) => p.id === fileObj.id);
                  const bgColor = getContrastingBackground(color);
                  return (
                    <div key={fileObj.id} className="file-card">
                      {preview?.url ? (
                        <div 
                          className="file-preview" 
                          style={{ backgroundColor: bgColor }}
                        >
                          <img src={preview.url} alt={fileObj.name} />
                        </div>
                      ) : (
                        <div className="file-preview-loading">Loading...</div>
                      )}
                      <div className="file-card-info">
                        <div className="file-card-name" title={fileObj.name}>
                          {fileObj.name}
                        </div>
                        <div className="file-card-size">
                          {formatFileSize(fileObj.size)}
                        </div>
                      </div>
                      <button
                        className="file-card-remove"
                        onClick={(e) => handleRemoveFile(fileObj.id, e)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="controls-section">
            <div className="controls-row">
              <div className="control-group">
                <label className="control-label">Aspect Ratio</label>
                <select 
                  className="ratio-select"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  disabled={isProcessing}
                >
                  {RATIO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label className="control-label">Padding Color</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    className="color-input"
                    value={tempColor}
                    onChange={handleColorChange}
                    onMouseUp={handleColorCommit}
                    onBlur={handleColorCommit}
                    disabled={isProcessing}
                  />
                  <span className="color-hex">{tempColor.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <button
              className="process-button"
              onClick={handleProcess}
              disabled={selectedFiles.length === 0 || isProcessing}
            >
              {isProcessing
                ? `Processing ${selectedFiles.length} image(s)...`
                : `Process ${selectedFiles.length} image(s)`}
            </button>
          </div>
        </>
      )}

      {isProcessing && (
        <div className="processing-section">
          <h3>Processing Images...</h3>
          {processingProgress.map((progress) => {
            const fileObj = selectedFiles.find((f) => f.id === progress.id);
            return (
              <div key={progress.id} className="processing-item">
                <div className="processing-filename">{fileObj?.name}</div>
                <div className="progress-bar-container">
                  <div className="progress-percentage">
                    {getProgressText(progress.stage, progress.progress)}
                  </div>
                  <div
                    className={`progress-bar ${progress.stage === 'error' ? 'error' : ''}`}
                    style={{
                      width: `${progress.stage === 'error' ? 100 : progress.progress}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {results.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h2 className="result-title">
              {results.filter((r) => r.status === 'success').length} / {results.length} Images
              Processed
            </h2>
            <div className="results-actions">
              <button 
                className="download-all-button" 
                onClick={handleDownloadAll}
                disabled={results.filter((r) => r.status === 'success').length === 0}
              >
                Download All ({results.filter((r) => r.status === 'success').length})
              </button>
              <button className="clear-all-button" onClick={handleClearAll}>
                Clear All
              </button>
              <button className="reset-button" onClick={handleReset}>
                Process More
              </button>
            </div>
          </div>

          <div className="results-grid">
            {results.map((result) => {
              const bgColor = getContrastingBackground(color);
              const preview = previews.find((p) => p.id === result.id);
              
              return (
                <div
                  key={result.id}
                  className={`result-card ${result.status === 'error' ? 'error' : ''}`}
                >
                  {result.status === 'success' ? (
                    <>
                      <div 
                        className="result-image-container"
                        style={{ backgroundColor: bgColor }}
                      >
                        {preview?.url ? (
                          <img
                            src={preview.url}
                            alt={result.name}
                            className="result-card-image"
                          />
                        ) : (
                          <div className="result-loading">Loading preview...</div>
                        )}
                      </div>
                      <div className="result-card-info">
                        <div className="result-card-name" title={result.result.filename}>
                          {result.result.filename || result.name}
                        </div>
                        {result.result.metadata && (
                          <>
                            <div className="result-card-meta">
                              {result.result.metadata.width} × {result.result.metadata.height} •{' '}
                              {formatFileSize(result.result.metadata.size)}
                            </div>
                            {result.result.expiresIn && (
                              <div className="result-card-expires">
                                Expires in: {result.result.expiresIn}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        className="result-download-button"
                        onClick={() => handleDownload(result.result.downloadUrl)}
                        title={`Download ${result.result.filename}`}
                      >
                        Download
                      </button>
                    </>
                  ) : (
                    <div className="result-card-error">
                      <div className="error-icon">!</div>
                      <div className="result-card-name">{result.name}</div>
                      <div className="result-card-error-msg">{result.error}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NoCrop;

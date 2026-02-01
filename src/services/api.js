import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to check server health');
  }
};

export const initializeUpload = async (filename, totalChunks, fileSize) => {
  try {
    const response = await api.post('/api/upload/init', {
      filename,
      totalChunks,
      fileSize,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to initialize upload');
  }
};

export const uploadChunk = async (uploadId, chunkIndex, totalChunks, chunk, onProgress) => {
  try {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('chunk', chunk);

    const response = await api.post('/api/upload/chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            ((chunkIndex + progressEvent.loaded / progressEvent.total) / totalChunks) * 100
          );
          onProgress(percentCompleted, chunkIndex, totalChunks);
        }
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || `Failed to upload chunk ${chunkIndex}`);
  }
};

export const completeUpload = async (uploadId) => {
  try {
    const response = await api.post('/api/upload/complete', {
      uploadId,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to complete upload');
  }
};

export const processImage = async (uploadId, filename, ratio, color) => {
  try {
    const response = await api.post('/api/process', {
      uploadId,
      filename,
      ratio,
      color,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to process image');
  }
};

export const cancelUpload = async (uploadId) => {
  try {
    const response = await api.delete(`/api/upload/${uploadId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to cancel upload');
  }
};

export const getDownloadUrl = (filename) => {
  return `${API_BASE_URL}/api/process/download/${filename}`;
};

export const uploadFileWithChunks = async (file, onProgress) => {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // Step 1: Initialize upload
  const { uploadId } = await initializeUpload(file.name, totalChunks, file.size);
  
  try {
    // Step 2: Upload all chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      await uploadChunk(uploadId, i, totalChunks, chunk, onProgress);
    }
    
    // Step 3: Complete upload
    const result = await completeUpload(uploadId);
    return { uploadId, ...result };
  } catch (error) {
    // Cancel upload on error
    await cancelUpload(uploadId).catch(() => {});
    throw error;
  }
};

export const uploadAndProcessImage = async (file, ratio, color, onProgress) => {
  try {
    // Upload with chunks
    const uploadResult = await uploadFileWithChunks(file, (percent) => {
      if (onProgress) {
        onProgress({ stage: 'uploading', progress: percent });
      }
    });
    
    if (onProgress) {
      onProgress({ stage: 'processing', progress: 100 });
    }
    
    // Process image
    const processResult = await processImage(
      uploadResult.uploadId,
      file.name,
      ratio,
      color
    );
    
    return processResult;
  } catch (error) {
    throw error;
  }
};

/**
 * Upload multiple images for layout
 */
export const uploadImagesForLayout = async (files, onProgress) => {
  try {
    const uploadResults = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (onProgress) {
        onProgress({ 
          stage: 'uploading', 
          progress: Math.round((i / files.length) * 100),
          currentFile: i + 1,
          totalFiles: files.length
        });
      }
      
      // Upload each file
      const uploadResult = await uploadFileWithChunks(file, (percent) => {
        if (onProgress) {
          const baseProgress = (i / files.length) * 100;
          const fileProgress = (percent / 100) * (100 / files.length);
          onProgress({ 
            stage: 'uploading', 
            progress: Math.round(baseProgress + fileProgress),
            currentFile: i + 1,
            totalFiles: files.length
          });
        }
      });
      
      uploadResults.push({
        uploadId: uploadResult.uploadId,
        filename: file.name,
        originalIndex: i
      });
    }
    
    return uploadResults;
  } catch (error) {
    throw error;
  }
};

export const processLayout = async (layoutData) => {
  try {
    const response = await api.post('/api/layout/process', layoutData);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to process layout');
  }
};

export const uploadAndCreateLayout = async (files, layoutConfig, imageSettings, onProgress) => {
  try {
    // Step 1: Upload all images
    if (onProgress) {
      onProgress({ stage: 'uploading', progress: 0 });
    }
    
    const uploadResults = await uploadImagesForLayout(files, onProgress);
    
    // Step 2: Prepare layout data
    if (onProgress) {
      onProgress({ stage: 'processing', progress: 0 });
    }
    
    const layoutData = {
      layoutType: layoutConfig.layoutType,
      ratio: layoutConfig.ratio,
      backgroundColor: layoutConfig.backgroundColor,
      images: uploadResults.map((upload, index) => {
        const setting = imageSettings.find(s => s.index === index) || {};
        return {
          uploadId: upload.uploadId,
          filename: upload.filename,
          position: index,
          zoom: setting.zoom || 1.0,
          offsetX: setting.offsetX || 0,
          offsetY: setting.offsetY || 0,
        };
      }),
    };
    
    // Add dimensions if provided
    if (layoutConfig.dimensions) {
      layoutData.dimensions = {
        width: layoutConfig.dimensions.width,
        height: layoutConfig.dimensions.height,
      };
    }
    
    // Step 3: Process layout on server
    const result = await processLayout(layoutData);
    
    if (onProgress) {
      onProgress({ stage: 'completed', progress: 100 });
    }
    
    return result;
  } catch (error) {
    throw error;
  }
};

export default api;

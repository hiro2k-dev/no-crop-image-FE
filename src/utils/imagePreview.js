export const createImagePreview = async (file, ratio, color, maxWidth = 600) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Get original dimensions
          const originalWidth = img.width;
          const originalHeight = img.height;

          // Parse ratio
          let targetRatio;
          if (ratio === 'original') {
            targetRatio = originalWidth / originalHeight;
          } else {
            const [w, h] = ratio.split(':').map(Number);
            targetRatio = w / h;
          }

          const currentRatio = originalWidth / originalHeight;

          let canvasWidth, canvasHeight;
          let drawX = 0, drawY = 0;
          let drawWidth = originalWidth;
          let drawHeight = originalHeight;

          // Calculate canvas dimensions based on ratio
          if (ratio === 'original') {
            canvasWidth = originalWidth;
            canvasHeight = originalHeight;
          } else {
            if (currentRatio > targetRatio) {
              // Image is wider than target ratio
              canvasWidth = originalWidth;
              canvasHeight = Math.round(originalWidth / targetRatio);
              drawY = Math.round((canvasHeight - originalHeight) / 2);
            } else {
              // Image is taller than target ratio
              canvasHeight = originalHeight;
              canvasWidth = Math.round(originalHeight * targetRatio);
              drawX = Math.round((canvasWidth - originalWidth) / 2);
            }
          }

          // Scale down for preview
          let scale = 1;
          if (canvasWidth > maxWidth) {
            scale = maxWidth / canvasWidth;
            canvasWidth = Math.round(canvasWidth * scale);
            canvasHeight = Math.round(canvasHeight * scale);
            drawX = Math.round(drawX * scale);
            drawY = Math.round(drawY * scale);
            drawWidth = Math.round(drawWidth * scale);
            drawHeight = Math.round(drawHeight * scale);
          }

          // Set canvas size
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;

          // Fill background with color
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          // Draw image centered
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

          // Convert to data URL
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Get image dimensions from file
 */
export const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          ratio: (img.width / img.height).toFixed(2)
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

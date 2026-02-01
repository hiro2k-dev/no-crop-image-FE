const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

export const getInvertedColor = (color) => {
  const rgb = hexToRgb(color);
  if (!rgb) return '#FFFFFF'; // Default to white if invalid

  const inverted = {
    r: 255 - rgb.r,
    g: 255 - rgb.g,
    b: 255 - rgb.b,
  };

  return `#${inverted.r.toString(16).padStart(2, '0')}${inverted.g
    .toString(16)
    .padStart(2, '0')}${inverted.b.toString(16).padStart(2, '0')}`;
};

export const getContrastingBackground = (paddingColor) => {
  const rgb = hexToRgb(paddingColor);
  if (!rgb) return '#1a1a1a'; // Default dark

  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  return luminance < 0.5 ? '#f0f0f0' : '#0a0a0a';
};

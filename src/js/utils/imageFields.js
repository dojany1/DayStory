export function bindImageVariantFields({ imageInput, thumbInput }) {
  let suppressThumbReset = false;

  imageInput?.addEventListener('input', () => {
    if (suppressThumbReset) return;
    if (thumbInput) thumbInput.value = '';
  });

  return {
    applyUploadResult({ image_url = '', image_thumb_url = '' }) {
      suppressThumbReset = true;
      try {
        if (imageInput) {
          imageInput.value = image_url || '';
        }
        if (thumbInput) {
          thumbInput.value = image_thumb_url || '';
        }
        imageInput?.dispatchEvent(new Event('input', { bubbles: true }));
      } finally {
        suppressThumbReset = false;
      }
    },
  };
}

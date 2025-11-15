/**
 * Photo Upload with Client-Side Compression
 * Optimized for mobile devices
 */

(function() {
  'use strict';

  const API_URL = window.API_URL || 'http://localhost:3000';
  const MAX_WIDTH = 1920;
  const MAX_HEIGHT = 1920;
  const JPEG_QUALITY = 0.85;

  let selectedFile = null;
  let compressedBlob = null;

  /**
   * Initialize upload functionality
   */
  function init() {
    const uploadForm = document.getElementById('upload-form');
    if (!uploadForm) return;

    const photoInput = document.getElementById('photo-input');
    const removePreviewBtn = document.getElementById('remove-preview');

    photoInput.addEventListener('change', handleFileSelect);
    removePreviewBtn.addEventListener('click', clearPreview);
    uploadForm.addEventListener('submit', handleUpload);
  }

  /**
   * Handle file selection with preview and compression
   */
  async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showStatus('Veuillez sélectionner une image valide.', 'error');
      return;
    }

    selectedFile = file;

    try {
      // Show loading state
      showStatus('Optimisation de l\'image...', 'info');

      // Compress image
      compressedBlob = await compressImage(file);

      // Show preview
      showPreview(compressedBlob);

      // Enable submit button
      document.getElementById('upload-button').disabled = false;

      // Show compression results
      const originalSize = (file.size / 1024).toFixed(0);
      const compressedSize = (compressedBlob.size / 1024).toFixed(0);
      const savings = Math.round((1 - compressedBlob.size / file.size) * 100);

      showStatus(
        `Image optimisée (${originalSize}KB → ${compressedSize}KB, -${savings}%)`,
        'success'
      );
    } catch (error) {
      console.error('Error compressing image:', error);
      showStatus('Erreur lors de l\'optimisation. L\'image sera envoyée telle quelle.', 'warning');
      compressedBlob = file;
      showPreview(file);
      document.getElementById('upload-button').disabled = false;
    }
  }

  /**
   * Compress image using canvas
   */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function(e) {
        const img = new Image();

        img.onload = function() {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            JPEG_QUALITY
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Show image preview
   */
  function showPreview(blob) {
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');

    const url = URL.createObjectURL(blob);
    previewImage.src = url;
    previewContainer.hidden = false;
  }

  /**
   * Clear preview
   */
  function clearPreview() {
    const photoInput = document.getElementById('photo-input');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const uploadButton = document.getElementById('upload-button');

    photoInput.value = '';
    previewImage.src = '';
    previewContainer.hidden = true;
    uploadButton.disabled = true;
    selectedFile = null;
    compressedBlob = null;

    showStatus('', '');
  }

  /**
   * Handle form submission
   */
  async function handleUpload(event) {
    event.preventDefault();

    if (!compressedBlob) {
      showStatus('Veuillez sélectionner une photo.', 'error');
      return;
    }

    const form = event.target;
    const dogId = form.getAttribute('data-dog-id');
    const submitButton = document.getElementById('upload-button');
    const progressContainer = document.getElementById('upload-progress');

    try {
      // Disable form
      submitButton.disabled = true;
      submitButton.textContent = 'Envoi...';

      // Show progress
      progressContainer.hidden = false;
      updateProgress(0, 'Préparation...');

      // Upload photo
      await uploadPhoto(dogId, compressedBlob, (progress, text) => {
        updateProgress(progress, text);
      });

      // Success
      updateProgress(100, 'Photo envoyée avec succès !');
      showStatus('✓ Photo envoyée ! Elle sera visible après validation.', 'success');

      // Reset form after delay
      setTimeout(() => {
        clearPreview();
        submitButton.textContent = 'Envoyer';
        progressContainer.hidden = true;

        // Suggest page reload
        if (confirm('Photo envoyée avec succès ! Recharger la page pour voir les changements ?')) {
          window.location.reload();
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      showStatus('Erreur lors de l\'envoi. Veuillez réessayer.', 'error');
      submitButton.disabled = false;
      submitButton.textContent = 'Envoyer';
      progressContainer.hidden = true;
    }
  }

  /**
   * Upload photo to API with progress tracking
   */
  function uploadPhoto(dogId, blob, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();

      // GraphQL multipart request specification
      const operations = {
        query: `
          mutation CreateMedia($dogId: ID!, $file: Upload) {
            createMedia(data: {
              dog: { connect: { id: $dogId } }
              file: { upload: $file }
              type: photo
              name: "Photo ajoutée"
            }) {
              id
              status
            }
          }
        `,
        variables: {
          dogId: dogId,
          file: null
        }
      };

      formData.append('operations', JSON.stringify(operations));
      formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
      formData.append('0', blob, 'photo.jpg');

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete, `Envoi... ${percentComplete}%`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.errors) {
              reject(new Error(response.errors[0].message));
            } else {
              resolve(response.data.createMedia);
            }
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', `${API_URL}/api/graphql`);
      // Add header to bypass CSRF protection for legitimate uploads
      xhr.setRequestHeader('apollo-require-preflight', 'true');
      xhr.send(formData);
    });
  }

  /**
   * Update progress bar
   */
  function updateProgress(percent, text) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    progressFill.style.width = `${percent}%`;
    progressText.textContent = text || `${percent}%`;
  }

  /**
   * Show status message
   */
  function showStatus(message, type) {
    const statusEl = document.getElementById('upload-status');
    statusEl.textContent = message;
    statusEl.className = `photo-upload__status photo-upload__status--${type}`;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

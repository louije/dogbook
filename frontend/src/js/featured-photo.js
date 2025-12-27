/**
 * Featured Photo Selection in Lightbox
 * Allows users to set which photo is the main/featured one
 */

(function() {
  'use strict';

  const API_URL = window.API_URL || 'http://localhost:3000';
  let currentPhotoId = null;
  let currentDogId = null;

  /**
   * Initialize featured photo selection in lightbox
   */
  function init() {
    const lightbox = document.getElementById('lightbox');
    const setFeaturedButton = document.getElementById('lightbox-set-featured');
    const galleryItems = document.querySelectorAll('.dog-gallery__item');

    if (!lightbox || !setFeaturedButton) return;

    // When lightbox opens for gallery photos, store photo ID
    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        currentPhotoId = item.getAttribute('data-photo-id');
        currentDogId = item.getAttribute('data-dog-id');

        // Show the "set featured" button for gallery photos
        if (currentPhotoId && currentDogId) {
          setFeaturedButton.hidden = false;
        }
      });
    });

    // When lightbox opens for main photo, hide button
    const mainPhotoButton = document.querySelector('.dog-detail__image-button');
    if (mainPhotoButton) {
      mainPhotoButton.addEventListener('click', () => {
        setFeaturedButton.hidden = true;
        currentPhotoId = null;
        currentDogId = null;
      });
    }

    // Handle set featured button click
    setFeaturedButton.addEventListener('click', handleSetFeatured);
  }

  /**
   * Handle setting a photo as featured
   */
  async function handleSetFeatured(event) {
    const button = event.currentTarget;

    if (!currentPhotoId || !currentDogId) {
      console.error('Missing photo ID or dog ID');
      return;
    }

    if (!confirm('Définir cette photo comme photo principale ?')) {
      return;
    }

    try {
      // Show loading state
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = '⏳ Mise à jour...';

      await setFeaturedPhoto(currentDogId, currentPhotoId);

      // Success feedback
      button.textContent = '✓ La photo principale sera mise à jour dans quelques minutes';

      // Reload page after short delay to show the change
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error setting featured photo:', error);
      alert('Erreur lors de la mise à jour. Veuillez réessayer.');
      button.disabled = false;
      button.textContent = '★ Utiliser comme photo principale';
    }
  }

  /**
   * Set a photo as featured via GraphQL mutation
   * Updates the Media item's isFeatured flag
   * Note: Backend hook automatically unfeatures other photos for this dog
   */
  async function setFeaturedPhoto(dogId, mediaId) {
    const response = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
      },
      credentials: 'include',
      body: JSON.stringify({
        query: `
          mutation SetFeaturedPhoto($mediaId: ID!) {
            updateMedia(
              where: { id: $mediaId }
              data: { isFeatured: true }
            ) {
              id
              isFeatured
            }
          }
        `,
        variables: { mediaId }
      })
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data.updateMedia;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

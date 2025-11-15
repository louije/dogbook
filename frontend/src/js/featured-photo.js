/**
 * Featured Photo Selection
 * Allows users to set which photo is the main/featured one
 */

(function() {
  'use strict';

  const API_URL = window.API_URL || 'http://localhost:3000';

  /**
   * Initialize featured photo selection
   */
  function init() {
    const setFeaturedButtons = document.querySelectorAll('.dog-gallery__set-featured');

    setFeaturedButtons.forEach(button => {
      button.addEventListener('click', handleSetFeatured);
    });
  }

  /**
   * Handle setting a photo as featured
   */
  async function handleSetFeatured(event) {
    const button = event.currentTarget;
    const photoId = button.getAttribute('data-photo-id');
    const dogId = button.getAttribute('data-dog-id');

    if (!photoId || !dogId) {
      console.error('Missing photo ID or dog ID');
      return;
    }

    if (!confirm('Définir cette photo comme photo principale ?')) {
      return;
    }

    try {
      // Show loading state
      button.disabled = true;
      button.textContent = '⏳';

      await setFeaturedPhoto(dogId, photoId);

      // Success feedback
      button.textContent = '✓';

      // Reload page after short delay to show the change
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error setting featured photo:', error);
      alert('Erreur lors de la mise à jour. Veuillez réessayer.');
      button.disabled = false;
      button.textContent = '⭐';
    }
  }

  /**
   * Set a photo as featured via GraphQL mutation
   * Updates the Media item's isFeatured flag
   */
  async function setFeaturedPhoto(dogId, mediaId) {
    // First, get all media for this dog to unset isFeatured
    const getAllResponse = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
      },
      body: JSON.stringify({
        query: `
          query GetDogPhotos($dogId: ID!) {
            dog(where: { id: $dogId }) {
              photos {
                id
              }
            }
          }
        `,
        variables: { dogId }
      })
    });

    const allPhotosData = await getAllResponse.json();
    const photoIds = allPhotosData.data?.dog?.photos?.map(p => p.id) || [];

    // Unset isFeatured on all photos for this dog
    if (photoIds.length > 0) {
      await Promise.all(photoIds.map(id =>
        fetch(`${API_URL}/api/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apollo-require-preflight': 'true',
          },
          body: JSON.stringify({
            query: `
              mutation UnsetFeatured($id: ID!) {
                updateMedia(where: { id: $id }, data: { isFeatured: false }) {
                  id
                }
              }
            `,
            variables: { id }
          })
        })
      ));
    }

    // Set this photo as featured
    const response = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
      },
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

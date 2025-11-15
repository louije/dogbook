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
   */
  async function setFeaturedPhoto(dogId, mediaId) {
    const response = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
      },
      body: JSON.stringify({
        query: `
          mutation SetFeaturedPhoto($dogId: ID!, $mediaId: ID!) {
            updateDog(
              where: { id: $dogId }
              data: {
                photoFeatured: { connect: { id: $mediaId } }
              }
            ) {
              id
              photoFeatured {
                id
                url
              }
            }
          }
        `,
        variables: {
          dogId,
          mediaId
        }
      })
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data.updateDog;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

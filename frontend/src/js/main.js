/**
 * Main JavaScript for Dogbook
 * Vanilla JS - No frameworks
 */

(function() {
  'use strict';

  /**
   * Initialize the application
   */
  function init() {
    setupImageGallery();
    setupLazyLoading();
  }

  /**
   * Setup image gallery lightbox functionality
   */
  function setupImageGallery() {
    const galleryImages = document.querySelectorAll('.dog-gallery__image');

    if (galleryImages.length === 0) return;

    galleryImages.forEach(function(image) {
      image.addEventListener('click', function() {
        openLightbox(this.src, this.alt);
      });
    });
  }

  /**
   * Open image in lightbox
   */
  function openLightbox(src, alt) {
    // Create lightbox elements
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
      <div class="lightbox__overlay"></div>
      <div class="lightbox__content">
        <img src="${src}" alt="${alt}" class="lightbox__image">
        <button class="lightbox__close" aria-label="Fermer">&times;</button>
      </div>
    `;

    // Add lightbox styles if not already present
    if (!document.getElementById('lightbox-styles')) {
      const style = document.createElement('style');
      style.id = 'lightbox-styles';
      style.textContent = `
        .lightbox {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox__overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.9);
        }
        .lightbox__content {
          position: relative;
          max-width: 90%;
          max-height: 90%;
          z-index: 1;
        }
        .lightbox__image {
          max-width: 100%;
          max-height: 90vh;
          display: block;
        }
        .lightbox__close {
          position: absolute;
          top: -40px;
          right: 0;
          background: none;
          border: none;
          color: white;
          font-size: 40px;
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          line-height: 1;
        }
        .lightbox__close:hover {
          opacity: 0.7;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(lightbox);

    // Close on overlay click
    const overlay = lightbox.querySelector('.lightbox__overlay');
    overlay.addEventListener('click', function() {
      closeLightbox(lightbox);
    });

    // Close on button click
    const closeBtn = lightbox.querySelector('.lightbox__close');
    closeBtn.addEventListener('click', function() {
      closeLightbox(lightbox);
    });

    // Close on Escape key
    document.addEventListener('keydown', function handleEscape(e) {
      if (e.key === 'Escape') {
        closeLightbox(lightbox);
        document.removeEventListener('keydown', handleEscape);
      }
    });
  }

  /**
   * Close lightbox
   */
  function closeLightbox(lightbox) {
    lightbox.remove();
  }

  /**
   * Setup lazy loading for images
   */
  function setupLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        });
      });

      images.forEach(function(img) {
        imageObserver.observe(img);
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

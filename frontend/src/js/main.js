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
    setupSortingAndFiltering();
    setupSearchToggle();
    setupThemeToggle();
  }

  /**
   * Setup search toggle for mobile
   */
  function setupSearchToggle() {
    const toggleButton = document.getElementById('search-toggle');
    const searchContainer = document.getElementById('search-container');

    if (!toggleButton || !searchContainer) return;

    toggleButton.addEventListener('click', function() {
      toggleButton.classList.toggle('active');
      searchContainer.classList.toggle('active');

      // Focus input when opened on mobile
      if (searchContainer.classList.contains('active')) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          setTimeout(function() {
            searchInput.focus();
          }, 100);
        }
      }
    });
  }

  /**
   * Setup theme toggle (light/dark/snow modes)
   */
  function setupThemeToggle() {
    var root = document.documentElement;
    var snowInstance = null;
    var isHomePage = !!document.getElementById('dogs-grid');
    var themeButtons = document.querySelectorAll('.theme-button');

    // Load saved theme (no active state if using system default)
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      applyTheme(savedTheme);
    }

    // Add click handlers if buttons exist
    if (themeButtons.length) {
      themeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
          var theme = this.dataset.theme;
          var currentTheme = localStorage.getItem('theme');

          // If clicking the active button, clear preference and return to system default
          if (theme === currentTheme) {
            localStorage.removeItem('theme');
            root.classList.remove('light-mode', 'dark-mode', 'snow-mode');
            if (snowInstance) {
              snowInstance.stop();
              snowInstance = null;
            }
            updateActiveButton(null);
          } else {
            applyTheme(theme);
            localStorage.setItem('theme', theme);
          }
        });
      });
    }

    function applyTheme(theme, saveToStorage) {
      // Remove all theme classes
      root.classList.remove('light-mode', 'dark-mode', 'snow-mode');

      // Stop snow if active
      if (snowInstance) {
        snowInstance.stop();
        snowInstance = null;
      }

      // Apply the selected theme
      if (theme === 'light') {
        root.classList.add('light-mode');
      } else if (theme === 'dark') {
        root.classList.add('dark-mode');
      } else if (theme === 'snow') {
        // Snow mode: use dark mode styling, only show snow on home page
        root.classList.add('snow-mode');
        if (isHomePage && typeof PureSnow !== 'undefined') {
          snowInstance = PureSnow.start();
        }
      }

      updateActiveButton(theme);
    }

    function updateActiveButton(theme) {
      themeButtons.forEach(function(btn) {
        btn.classList.toggle('active', theme && btn.dataset.theme === theme);
      });
    }
  }

  /**
   * Setup image gallery lightbox functionality
   */
  function setupImageGallery() {
    const allImageButtons = document.querySelectorAll('.dog-gallery__item[data-image], .dog-detail__image-button[data-image]');
    const dialog = document.getElementById('lightbox');

    if (!dialog) return;

    const dialogImage = dialog.querySelector('.lightbox__image');
    const closeButton = dialog.querySelector('.lightbox__close');

    // Open lightbox on any image button click
    allImageButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        const src = this.dataset.image;
        const alt = this.dataset.alt;
        dialogImage.src = src;
        dialogImage.alt = alt;
        dialog.showModal();
      });
    });

    // Close on button click
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        dialog.close();
      });
    }

    // Close on backdrop click
    dialog.addEventListener('click', function(e) {
      if (e.target === dialog) {
        dialog.close();
      }
    });

    // Close on Escape key
    dialog.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        dialog.close();
      }
    });
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

  /**
   * Setup sorting and filtering functionality
   */
  function setupSortingAndFiltering() {
    const grid = document.getElementById('dogs-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.dog-card'));
    const searchInput = document.getElementById('search-input');

    // Add event listener for search
    if (searchInput) {
      searchInput.addEventListener('input', applyChanges);
    }

    // Apply initial sort by name
    applyChanges();

    function applyChanges() {
      let visibleCards = filterCards(cards);
      visibleCards = sortCards(visibleCards);
      renderCards(visibleCards);
    }

    function filterCards(cards) {
      const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : '';

      return cards.filter(function(card) {
        const cardName = card.dataset.name || '';
        const cardBreed = card.dataset.breed || '';
        const cardCoat = card.dataset.coat || '';
        const cardOwner = card.dataset.owner || '';

        // Search matches name, breed, coat, or owner
        const searchMatch = !searchValue ||
          cardName.includes(searchValue) ||
          cardBreed.includes(searchValue) ||
          cardCoat.includes(searchValue) ||
          cardOwner.includes(searchValue);

        return searchMatch;
      });
    }

    function sortCards(cards) {
      return cards.slice().sort(function(a, b) {
        const aValue = a.dataset.name || '';
        const bValue = b.dataset.name || '';
        return aValue.localeCompare(bValue, 'fr');
      });
    }

    function renderCards(visibleCards) {
      // Clear grid
      grid.innerHTML = '';

      // Append visible cards in sorted order
      visibleCards.forEach(function(card) {
        grid.appendChild(card);
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

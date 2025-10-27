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
    setupSearchFilterToggle();
  }

  /**
   * Setup combined search and filter toggle for mobile
   */
  function setupSearchFilterToggle() {
    const toggleButton = document.getElementById('search-filter-toggle');
    const searchContainer = document.getElementById('search-container');
    const filterControls = document.getElementById('filter-controls');

    if (!toggleButton || !searchContainer || !filterControls) return;

    toggleButton.addEventListener('click', function() {
      toggleButton.classList.toggle('active');
      searchContainer.classList.toggle('active');
      filterControls.classList.toggle('active');

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
   * Setup image gallery lightbox functionality
   */
  function setupImageGallery() {
    const galleryButtons = document.querySelectorAll('.dog-gallery__item[data-image]');
    const dialog = document.getElementById('lightbox');

    if (!dialog || galleryButtons.length === 0) return;

    const dialogImage = dialog.querySelector('.lightbox__image');
    const closeButton = dialog.querySelector('.lightbox__close');

    // Open lightbox on gallery item click
    galleryButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        const src = this.dataset.image;
        const alt = this.dataset.alt;
        dialogImage.src = src;
        dialogImage.alt = alt;
        dialog.showModal();
      });
    });

    // Close on button click
    closeButton.addEventListener('click', function() {
      dialog.close();
    });

    // Close on backdrop click
    dialog.addEventListener('click', function(e) {
      if (e.target === dialog) {
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
    const sortSelect = document.getElementById('sort');
    const filterSex = document.getElementById('filter-sex');
    const filterBreed = document.getElementById('filter-breed');
    const filterCoat = document.getElementById('filter-coat');
    const searchInput = document.getElementById('search-input');

    // Populate breed and coat filters
    populateFilterOptions(cards, 'breed', filterBreed);
    populateFilterOptions(cards, 'coat', filterCoat);

    // Add event listeners
    if (sortSelect) {
      sortSelect.addEventListener('change', applyChanges);
    }
    if (filterSex) {
      filterSex.addEventListener('change', applyChanges);
    }
    if (filterBreed) {
      filterBreed.addEventListener('change', applyChanges);
    }
    if (filterCoat) {
      filterCoat.addEventListener('change', applyChanges);
    }
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
      const sexValue = filterSex ? filterSex.value : '';
      const breedValue = filterBreed ? filterBreed.value : '';
      const coatValue = filterCoat ? filterCoat.value : '';
      const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : '';

      return cards.filter(function(card) {
        const cardSex = card.dataset.sex || '';
        const cardBreed = card.dataset.breed || '';
        const cardCoat = card.dataset.coat || '';
        const cardName = card.dataset.name || '';
        const cardOwner = card.dataset.owner || '';

        const sexMatch = !sexValue || cardSex === sexValue;
        const breedMatch = !breedValue || cardBreed === breedValue;
        const coatMatch = !coatValue || cardCoat === coatValue;

        // Search matches name, breed, coat, or owner
        const searchMatch = !searchValue ||
          cardName.includes(searchValue) ||
          cardBreed.includes(searchValue) ||
          cardCoat.includes(searchValue) ||
          cardOwner.includes(searchValue);

        return sexMatch && breedMatch && coatMatch && searchMatch;
      });
    }

    function sortCards(cards) {
      const sortBy = sortSelect ? sortSelect.value : 'name';

      return cards.slice().sort(function(a, b) {
        const aValue = a.dataset[sortBy] || '';
        const bValue = b.dataset[sortBy] || '';
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

    function populateFilterOptions(cards, attribute, selectElement) {
      const values = new Set();
      cards.forEach(function(card) {
        const value = card.dataset[attribute];
        if (value && value !== 'undefined' && value !== '') {
          values.add(value);
        }
      });

      const sortedValues = Array.from(values).sort(function(a, b) {
        return a.localeCompare(b, 'fr');
      });

      sortedValues.forEach(function(value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = capitalizeFirst(value);
        selectElement.appendChild(option);
      });
    }

    function capitalizeFirst(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

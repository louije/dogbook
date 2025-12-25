/**
 * Owner Autocomplete Component
 * Searches existing owners and allows creating new ones
 */

import { searchOwners } from './api.js';

export class OwnerAutocomplete {
  constructor(container, text, initialOwner = null) {
    this.container = container;
    this.text = text;
    this.selectedOwner = initialOwner;
    this.results = [];
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <input
        type="text"
        class="owner-search"
        placeholder="${this.text.owner.search_placeholder}"
        value="${this.selectedOwner?.name || ''}"
        autocomplete="off"
      >
      <div class="owner-results" hidden></div>
    `;

    const input = this.container.querySelector('.owner-search');
    const resultsDiv = this.container.querySelector('.owner-results');

    // Debounced search
    let timeout;
    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      const term = e.target.value.trim();
      if (term.length >= 2) {
        timeout = setTimeout(() => this.search(term, resultsDiv), 300);
      } else {
        resultsDiv.hidden = true;
      }
    });

    // Clear selection on edit
    input.addEventListener('focus', () => {
      if (this.selectedOwner && !this.selectedOwner.isNew) {
        // Allow re-searching
        this.selectedOwner = null;
      }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        resultsDiv.hidden = true;
      }
    });
  }

  async search(term, resultsDiv) {
    try {
      const data = await searchOwners(term);
      this.results = data.owners || [];
      this.renderResults(term, resultsDiv);
    } catch (error) {
      console.error('Search error:', error);
      resultsDiv.hidden = true;
    }
  }

  renderResults(searchTerm, resultsDiv) {
    resultsDiv.innerHTML = '';

    // Show existing owners
    this.results.forEach(owner => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'owner-result';

      const dogsCount = this.text.owner.dogs_count.replace('{count}', owner.dogs.length);
      item.innerHTML = `
        <strong>${owner.name}</strong>
        <small>${dogsCount}</small>
      `;
      item.addEventListener('click', () => this.selectOwner(owner, resultsDiv));
      resultsDiv.appendChild(item);
    });

    // Option to create new
    const createNew = document.createElement('button');
    createNew.type = 'button';
    createNew.className = 'owner-result owner-result--create';
    createNew.textContent = this.text.owner.create_new.replace('{name}', searchTerm);
    createNew.addEventListener('click', () => this.selectNewOwner(searchTerm, resultsDiv));
    resultsDiv.appendChild(createNew);

    resultsDiv.hidden = false;
  }

  selectOwner(owner, resultsDiv) {
    this.selectedOwner = owner;
    this.container.querySelector('.owner-search').value = owner.name;
    resultsDiv.hidden = true;
  }

  selectNewOwner(name, resultsDiv) {
    this.selectedOwner = { name, isNew: true };
    this.container.querySelector('.owner-search').value = name;
    resultsDiv.hidden = true;
  }

  getValue() {
    if (!this.selectedOwner) {
      // Fallback: treat typed value as new owner
      const name = this.container.querySelector('.owner-search').value.trim();
      return name ? { name, isNew: true } : null;
    }
    return this.selectedOwner;
  }
}

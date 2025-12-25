/**
 * Edit Dog Modal Component
 * Handles both creating and editing dogs
 */

import { updateDog, createDog, getModerationMode } from './api.js';
import { OwnerAutocomplete } from './owner-autocomplete.js';
import { showNotification } from './magic-auth.js';

export class EditDogModal {
  constructor(content, dog = null) {
    this.content = content;
    this.dog = dog; // null for create, object for edit
    this.dialog = this.createDialog();
    this.ownerAutocomplete = null;
  }

  createDialog() {
    const isEdit = !!this.dog;
    const title = isEdit
      ? this.content.dialog.edit_dog_title.replace('{name}', this.dog.name)
      : this.content.dialog.add_dog_title;

    const dialog = document.createElement('dialog');
    dialog.className = 'edit-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="edit-form">
        <header class="edit-form__header">
          <h2>${title}</h2>
          <button type="button" class="close-button" aria-label="${this.content.form.close}">×</button>
        </header>

        <div class="edit-form__body">
          <label>
            <span>${this.content.dog.name} *</span>
            <input type="text" name="name" required value="${this.dog?.name || ''}">
          </label>

          <label>
            <span>${this.content.dog.sex}</span>
            <select name="sex">
              <option value="">-</option>
              <option value="male" ${this.dog?.sex === 'male' ? 'selected' : ''}>
                ${this.content.dog.sex_male}
              </option>
              <option value="female" ${this.dog?.sex === 'female' ? 'selected' : ''}>
                ${this.content.dog.sex_female}
              </option>
            </select>
          </label>

          <label>
            <span>${this.content.dog.birthday}</span>
            <input type="date" name="birthday" value="${this.dog?.birthday || ''}">
          </label>

          <label>
            <span>${this.content.dog.breed}</span>
            <input type="text" name="breed" value="${this.dog?.breed || ''}">
          </label>

          <label>
            <span>${this.content.dog.coat}</span>
            <input type="text" name="coat" value="${this.dog?.coat || ''}">
          </label>

          <label>
            <span>${this.content.dog.owner} *</span>
            <div id="owner-autocomplete" style="position: relative;"></div>
          </label>
        </div>

        <footer class="edit-form__footer">
          <button type="button" class="button button--secondary cancel-button">
            ${this.content.form.cancel}
          </button>
          <button type="submit" class="button button--primary">
            ${this.content.form.save}
          </button>
        </footer>
      </form>
    `;

    // Setup owner autocomplete
    const autocompleteContainer = dialog.querySelector('#owner-autocomplete');
    this.ownerAutocomplete = new OwnerAutocomplete(
      autocompleteContainer,
      this.content,
      this.dog?.owner
    );

    // Event listeners
    const form = dialog.querySelector('form');
    dialog.querySelector('.close-button').addEventListener('click', () => this.close());
    dialog.querySelector('.cancel-button').addEventListener('click', () => this.close());
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        this.close();
      }
    });

    // Close on Escape key
    dialog.addEventListener('cancel', () => {
      this.close();
    });

    return dialog;
  }

  async handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = this.content.form.saving;

    try {
      // Get owner from autocomplete
      const ownerData = this.ownerAutocomplete.getValue();

      if (!ownerData) {
        throw new Error(this.content.form.required + ': ' + this.content.dog.owner);
      }

      // Prepare dog data
      const dogData = {
        name: formData.get('name'),
        sex: formData.get('sex') || null,
        birthday: formData.get('birthday') || null,
        breed: formData.get('breed') || '',
        coat: formData.get('coat') || '',
      };

      // Handle owner
      if (ownerData.isNew) {
        // Create new owner inline
        dogData.owner = {
          create: {
            name: ownerData.name,
            email: '',
            phone: '',
          },
        };
      } else {
        // Connect to existing owner
        dogData.owner = {
          connect: { id: ownerData.id },
        };
      }

      if (this.dog) {
        // Update existing dog
        await updateDog(this.dog.id, dogData);
        showNotification(this.content.messages.dog_updated, 'success');
      } else {
        // Create new dog
        await createDog(dogData);

        // Show appropriate message based on moderation
        const moderationMode = await getModerationMode();
        const message = moderationMode === 'a_posteriori'
          ? this.content.messages.dog_created_aposteriori
          : this.content.messages.dog_created_apriori;
        showNotification(message, 'success');
      }

      this.close();

      // Reload page after short delay to show changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error saving dog:', error);

      const errorMessage = error.message.includes('Unauthorized') || error.message.includes('Access denied')
        ? this.content.messages.error_unauthorized
        : this.content.messages.error_generic;

      showNotification(errorMessage, 'error');

      submitButton.disabled = false;
      submitButton.textContent = this.content.form.save;
    }
  }

  show() {
    document.body.appendChild(this.dialog);
    this.dialog.showModal();

    // Focus first input
    const firstInput = this.dialog.querySelector('input[name="name"]');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  close() {
    this.dialog.close();
    setTimeout(() => this.dialog.remove(), 300);
  }
}

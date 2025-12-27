/**
 * Edit Dog Modal Component
 * Handles both creating and editing dogs
 */

import { updateDog, createDog, getModerationMode, updateOwner } from './api.js';
import { OwnerAutocomplete } from './owner-autocomplete.js';
import { showNotification } from './magic-auth.js';

export class EditDogModal {
  constructor(text) {
    this.text = text;
    this.dog = null;
    this.dialog = null;
    this.ownerAutocomplete = null;
  }

  open(dog = null) {
    this.dog = dog;

    // Remove old dialog if it exists
    if (this.dialog) {
      this.dialog.remove();
    }

    // Create fresh dialog with current dog data
    this.dialog = this.createDialog();
    this.show();
  }

  createDialog() {
    const isEdit = !!this.dog;
    const title = isEdit
      ? this.text.dialog.edit_dog_title.replace('{name}', this.dog.name)
      : this.text.dialog.add_dog_title;

    const dialog = document.createElement('dialog');
    dialog.className = 'edit-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="edit-form">
        <header class="edit-form__header">
          <h2>${title}</h2>
          <button type="button" class="close-button" aria-label="${this.text.form.close}">×</button>
        </header>

        <div class="edit-form__body">
          <label>
            <span>${this.text.dog.name} *</span>
            <input type="text" name="name" required value="${this.dog?.name || ''}">
          </label>

          <label>
            <span>${this.text.dog.sex}</span>
            <select name="sex">
              <option value="">-</option>
              <option value="male" ${this.dog?.sex === 'male' ? 'selected' : ''}>
                ${this.text.dog.sex_male}
              </option>
              <option value="female" ${this.dog?.sex === 'female' ? 'selected' : ''}>
                ${this.text.dog.sex_female}
              </option>
            </select>
          </label>

          <label>
            <span>${this.text.dog.birthday}</span>
            <input type="date" name="birthday" value="${this.dog?.birthday || ''}">
          </label>

          <label>
            <span>${this.text.dog.breed}</span>
            <input type="text" name="breed" value="${this.dog?.breed || ''}">
          </label>

          <label>
            <span>${this.text.dog.coat}</span>
            <input type="text" name="coat" value="${this.dog?.coat || ''}">
          </label>

          <label>
            <span>${this.text.dog.owner} *</span>
            ${isEdit
              ? `<input type="text" name="ownerName" required value="${this.dog?.owner?.name || ''}">`
              : '<div id="owner-autocomplete" style="position: relative;"></div>'
            }
          </label>
        </div>

        <footer class="edit-form__footer">
          <button type="button" class="button button--secondary cancel-button">
            ${this.text.form.cancel}
          </button>
          <button type="submit" class="button button--primary">
            ${this.text.form.save}
          </button>
        </footer>
      </form>
    `;

    // Setup owner autocomplete (only for new dogs)
    if (!isEdit) {
      const autocompleteContainer = dialog.querySelector('#owner-autocomplete');
      this.ownerAutocomplete = new OwnerAutocomplete(
        autocompleteContainer,
        this.text,
        null
      );
    } else {
      this.ownerAutocomplete = null;
    }

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
    submitButton.textContent = this.text.form.saving;

    try {
      // Prepare dog data
      const dogData = {
        name: formData.get('name'),
        sex: formData.get('sex') || null,
        birthday: formData.get('birthday') || null,
        breed: formData.get('breed') || '',
        coat: formData.get('coat') || '',
      };

      if (this.dog) {
        // Editing existing dog - update owner name directly
        const newOwnerName = formData.get('ownerName')?.trim();
        if (!newOwnerName) {
          throw new Error(this.text.form.required + ': ' + this.text.dog.owner);
        }

        // Update owner if name changed
        if (this.dog.owner && newOwnerName !== this.dog.owner.name) {
          await updateOwner(this.dog.owner.id, { name: newOwnerName });
        }

        await updateDog(this.dog.id, dogData);
        showNotification(this.text.messages.dog_updated, 'success');
      } else {
        // Creating new dog - use autocomplete for owner
        const ownerData = this.ownerAutocomplete.getValue();

        if (!ownerData) {
          throw new Error(this.text.form.required + ': ' + this.text.dog.owner);
        }

        if (ownerData.isNew) {
          dogData.owner = { create: { name: ownerData.name } };
        } else {
          dogData.owner = { connect: { id: ownerData.id } };
        }
        // Create new dog
        await createDog(dogData);

        // Show appropriate message based on moderation
        const moderationMode = await getModerationMode();
        const message = moderationMode === 'a_posteriori'
          ? this.text.messages.dog_created_aposteriori
          : this.text.messages.dog_created_apriori;
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
        ? this.text.messages.error_unauthorized
        : this.text.messages.error_generic;

      showNotification(errorMessage, 'error');

      submitButton.disabled = false;
      submitButton.textContent = this.text.form.save;
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

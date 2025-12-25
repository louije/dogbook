/**
 * Edit Owner Modal Component
 * Handles editing owner information
 */

import { updateOwner } from './api.js';
import { showNotification } from './magic-auth.js';

export class EditOwnerModal {
  constructor(text) {
    this.text = text;
    this.owner = null;
    this.dialog = null;
  }

  open(owner) {
    if (!owner) {
      console.error('EditOwnerModal.open() requires owner data');
      return;
    }

    this.owner = owner;

    // Remove old dialog if it exists
    if (this.dialog) {
      this.dialog.remove();
    }

    // Create fresh dialog with current owner data
    this.dialog = this.createDialog();
    this.show();
  }

  createDialog() {
    const title = this.text.dialog.edit_owner_title.replace('{name}', this.owner.name);

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
            <span>${this.text.owner.name} *</span>
            <input type="text" name="name" required value="${this.owner.name || ''}">
          </label>

          <label>
            <span>${this.text.owner.email}</span>
            <input type="email" name="email" value="${this.owner.email || ''}">
          </label>

          <label>
            <span>${this.text.owner.phone}</span>
            <input type="tel" name="phone" value="${this.owner.phone || ''}">
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
      const ownerData = {
        name: formData.get('name'),
        email: formData.get('email') || '',
        phone: formData.get('phone') || '',
      };

      await updateOwner(this.owner.id, ownerData);
      showNotification(this.text.messages.owner_updated, 'success');

      this.close();

      // Reload page after short delay to show changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error saving owner:', error);

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

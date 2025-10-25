import { list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import {
  text,
  relationship,
  select,
  integer,
  image,
  checkbox,
} from '@keystone-6/core/fields';
import { document } from '@keystone-6/fields-document';
import { buildTriggerHooks } from './hooks';

export const lists = {
  Dog: list({
    access: allowAll,
    hooks: buildTriggerHooks,
    fields: {
      nom: text({ validation: { isRequired: true } }),
      sexe: select({
        type: 'enum',
        options: [
          { label: 'Mâle', value: 'male' },
          { label: 'Femelle', value: 'female' },
        ],
        validation: { isRequired: true },
      }),
      age: integer({ validation: { isRequired: true } }),
      race: text({ validation: { isRequired: true } }),
      robe: text({
        validation: { isRequired: true },
        db: { isNullable: false },
      }),
      maitre: relationship({
        ref: 'Owner.dogs',
        many: false,
      }),
      // Note: KeystoneJS 6 uses cloud storage for images by default
      // For local storage, we'll need to configure this
      photoFeatured: image({ storage: 'local_images' }),
      photos: relationship({
        ref: 'Media.dog',
        many: true,
      }),
      description: document({
        formatting: true,
        links: true,
        dividers: true,
      }),
    },
  }),

  Owner: list({
    access: allowAll,
    hooks: buildTriggerHooks,
    fields: {
      nom: text({ validation: { isRequired: true } }),
      email: text({
        validation: { isRequired: false },
        isIndexed: 'unique',
      }),
      telephone: text(),
      dogs: relationship({
        ref: 'Dog.maitre',
        many: true,
      }),
    },
  }),

  Media: list({
    access: allowAll,
    hooks: buildTriggerHooks,
    fields: {
      nom: text(),
      file: image({ storage: 'local_images' }),
      type: select({
        type: 'enum',
        options: [
          { label: 'Photo', value: 'photo' },
          { label: 'Vidéo', value: 'video' },
        ],
        defaultValue: 'photo',
      }),
      videoUrl: text({
        ui: {
          description: 'URL de la vidéo (YouTube, Vimeo, etc.)',
        },
      }),
      dog: relationship({
        ref: 'Dog.photos',
        many: false,
      }),
      isFeatured: checkbox({
        defaultValue: false,
        ui: {
          description: 'Utiliser comme photo principale',
        },
      }),
    },
  }),
};

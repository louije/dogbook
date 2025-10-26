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
      name: text({
        validation: { isRequired: true },
        label: 'Nom',
      }),
      sex: select({
        type: 'enum',
        options: [
          { label: 'Mâle', value: 'male' },
          { label: 'Femelle', value: 'female' },
        ],
        validation: { isRequired: false },
        label: 'Sexe',
      }),
      age: integer({
        validation: { isRequired: false },
        label: 'Âge',
      }),
      breed: text({
        validation: { isRequired: false },
        label: 'Race',
      }),
      coat: text({
        validation: { isRequired: false },
        label: 'Robe',
      }),
      owner: relationship({
        ref: 'Owner.dogs',
        many: false,
        label: 'Maître',
        validation: { isRequired: true },
      }),
      // Note: KeystoneJS 6 uses cloud storage for images by default
      // For local storage, we'll need to configure this
      photoFeatured: image({
        storage: 'local_images',
        label: 'Photo principale',
        validation: { isRequired: true },
      }),
      photos: relationship({
        ref: 'Media.dog',
        many: true,
        label: 'Photos',
      }),
      description: document({
        formatting: true,
        links: true,
        dividers: true,
        label: 'Description',
      }),
    },
  }),

  Owner: list({
    access: allowAll,
    hooks: buildTriggerHooks,
    fields: {
      name: text({
        validation: { isRequired: true },
        label: 'Nom',
      }),
      email: text({
        validation: { isRequired: false },
        label: 'Email',
      }),
      phone: text({
        label: 'Téléphone',
      }),
      dogs: relationship({
        ref: 'Dog.owner',
        many: true,
        label: 'Chiens',
      }),
    },
  }),

  Media: list({
    access: allowAll,
    hooks: buildTriggerHooks,
    graphql: {
      plural: 'MediaItems',
    },
    fields: {
      name: text({
        label: 'Nom',
      }),
      file: image({
        storage: 'local_images',
        label: 'Fichier',
      }),
      type: select({
        type: 'enum',
        options: [
          { label: 'Photo', value: 'photo' },
          { label: 'Vidéo', value: 'video' },
        ],
        defaultValue: 'photo',
        label: 'Type',
      }),
      videoUrl: text({
        ui: {
          description: 'URL de la vidéo (YouTube, Vimeo, etc.)',
        },
        label: 'URL de la vidéo',
      }),
      dog: relationship({
        ref: 'Dog.photos',
        many: false,
        label: 'Chien',
      }),
      isFeatured: checkbox({
        defaultValue: false,
        ui: {
          description: 'Utiliser comme photo principale',
        },
        label: 'Photo principale',
      }),
    },
  }),
};

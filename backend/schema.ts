import { list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import {
  text,
  relationship,
  select,
  calendarDay,
  image,
  checkbox,
  password,
  timestamp,
} from '@keystone-6/core/fields';
import { document } from '@keystone-6/fields-document';
import { buildTriggerHooks } from './hooks';

// Helper function to check if user is authenticated
const isAuthenticated = ({ session }: any) => !!session;

export const lists = {
  User: list({
    access: {
      operation: {
        query: isAuthenticated, // Only authenticated users can view users
        create: isAuthenticated, // Only authenticated users can create users
        update: isAuthenticated, // Only authenticated users can update users
        delete: isAuthenticated, // Only authenticated users can delete users
      },
    },
    ui: {
      label: 'Utilisateur',
      plural: 'Utilisateurs',
      labelField: 'name',
      isHidden: ({ session }) => !session, // Hide from non-authenticated users
      listView: {
        initialColumns: ['name', 'email'],
      },
    },
    fields: {
      name: text({
        validation: { isRequired: true },
        label: 'Nom',
      }),
      email: text({
        validation: { isRequired: true },
        isIndexed: 'unique',
        label: 'Email',
      }),
      password: password({
        validation: { isRequired: true },
        label: 'Mot de passe',
      }),
      createdAt: timestamp({
        defaultValue: { kind: 'now' },
        label: 'Créé le',
      }),
    },
  }),

  Dog: list({
    access: {
      operation: {
        query: () => true, // Anyone can view
        create: isAuthenticated, // Only authenticated users can create
        update: () => true, // Anyone can update (controlled at field level)
        delete: isAuthenticated, // Only authenticated users can delete
      },
    },
    hooks: buildTriggerHooks,
    ui: {
      label: 'Chien',
      plural: 'Chiens',
      labelField: 'name',
      listView: {
        defaultFieldMode: 'read',
        initialColumns: ['name', 'sex', 'breed', 'coat', 'owner', 'photoFeatured', 'description'],
        initialSort: { field: 'name', direction: 'ASC' },
      },
    },
    fields: {
      name: text({
        validation: { isRequired: true },
        label: 'Nom',
        access: {
          update: isAuthenticated, // Only authenticated users can change name
        },
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
      birthday: calendarDay({
        validation: { isRequired: false },
        label: 'Anniversaire',
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
        label: 'Humain',
        validation: { isRequired: true },
        access: {
          update: isAuthenticated, // Only authenticated users can change owner
        },
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
    access: {
      operation: {
        query: () => true, // Anyone can view
        create: isAuthenticated, // Only authenticated users can create
        update: isAuthenticated, // Only authenticated users can update
        delete: isAuthenticated, // Only authenticated users can delete
      },
    },
    hooks: buildTriggerHooks,
    ui: {
      label: 'Humain',
      plural: 'Humains',
      labelField: 'name',
      isHidden: ({ session }) => !session, // Hide from non-authenticated users
      listView: {
        defaultFieldMode: 'read',
        initialColumns: ['name', 'dogs', 'email', 'phone'],
        initialSort: { field: 'name', direction: 'ASC' },
      },
    },
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
    ui: {
      label: 'Média',
      plural: 'Médias',
      labelField: 'name',
      isHidden: ({ session }) => !session, // Hide from non-authenticated users
      listView: {
        defaultFieldMode: 'read',
        initialColumns: ['type', 'dog', 'file'],
      },
      itemView: {
        defaultFieldMode: 'edit',
      },
    },
    graphql: {
      plural: 'MediaItems',
    },
    fields: {
      name: text({
        label: 'Nom',
        defaultValue: 'Photo',
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
        ui: {
          displayMode: 'select',
          labelField: 'name',
        },
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

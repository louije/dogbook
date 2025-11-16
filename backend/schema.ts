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
import { buildTriggerHooks, mediaHooks } from './hooks';

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
        initialColumns: ['name', 'sex', 'breed', 'coat', 'owner', 'photos'],
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
      photos: relationship({
        ref: 'Media.dog',
        many: true,
        label: 'Photos',
        ui: {
          description: 'Utilisez le bouton ⭐ pour définir la photo principale',
        },
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
    access: {
      operation: {
        query: () => true, // Anyone can view
        create: () => true, // Anyone can upload
        update: () => true, // Anyone can update (field-level control below)
        delete: isAuthenticated,
      },
    },
    hooks: mediaHooks,
    ui: {
      label: 'Média',
      plural: 'Médias',
      labelField: 'name',
      isHidden: ({ session }) => !session, // Hide from non-authenticated users
      listView: {
        defaultFieldMode: 'read',
        initialColumns: ['status', 'type', 'dog', 'file', 'uploadedAt'],
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
          description: 'Photo principale du chien (une seule par chien)',
        },
        label: 'Photo principale',
      }),
      status: select({
        type: 'enum',
        options: [
          { label: '⏳ En attente', value: 'pending' },
          { label: '✅ Approuvée', value: 'approved' },
          { label: '❌ Rejetée', value: 'rejected' },
        ],
        defaultValue: 'pending',
        label: 'Statut',
        access: {
          create: () => true,
          update: isAuthenticated, // Only admin can change status
        },
        ui: {
          displayMode: 'segmented-control',
        },
      }),
      uploadedAt: timestamp({
        label: 'Uploadée le',
        db: { isNullable: true },
        ui: {
          createView: { fieldMode: 'hidden' },
          itemView: { fieldMode: 'read' },
        },
      }),
    },
  }),

  Settings: list({
    access: {
      operation: {
        query: () => true, // Anyone can view settings (for moderation mode)
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
      },
    },
    isSingleton: true,
    graphql: {
      plural: 'SettingsItems',
    },
    ui: {
      label: 'Paramètres',
      isHidden: ({ session }) => !session,
    },
    fields: {
      moderationMode: select({
        type: 'enum',
        options: [
          { label: 'A posteriori (publier puis notifier)', value: 'a_posteriori' },
          { label: 'A priori (approuver avant de publier)', value: 'a_priori' },
        ],
        defaultValue: 'a_posteriori',
        label: 'Mode de modération',
        ui: {
          displayMode: 'segmented-control',
          description: 'A posteriori: les photos sont publiées immédiatement. A priori: les photos doivent être approuvées avant publication.',
        },
      }),
    },
  }),

  PushSubscription: list({
    access: {
      operation: {
        query: isAuthenticated,
        create: () => true, // Anyone can subscribe
        update: isAuthenticated,
        delete: () => true, // Anyone can unsubscribe
      },
    },
    ui: {
      label: 'Abonnement Push',
      plural: 'Abonnements Push',
      isHidden: ({ session }) => !session,
      listView: {
        initialColumns: ['endpoint', 'createdAt'],
      },
    },
    fields: {
      endpoint: text({
        validation: { isRequired: true },
        isIndexed: 'unique',
        label: 'Endpoint',
      }),
      keys: text({
        validation: { isRequired: true },
        label: 'Keys (JSON)',
        ui: {
          displayMode: 'textarea',
        },
      }),
      receivesAdminNotifications: checkbox({
        defaultValue: false,
        label: 'Reçoit notifications admin',
        ui: {
          description: 'Cette souscription reçoit les notifications administrateur',
        },
      }),
      createdAt: timestamp({
        label: 'Créé le',
        db: { isNullable: true },
      }),
    },
  }),
};

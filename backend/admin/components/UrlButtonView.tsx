/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import { FieldProps } from '@keystone-6/core/types';
import { controller } from '@keystone-6/core/fields/types/text/views';

export const Field = ({ field, value }: FieldProps<typeof controller>) => {
  if (!value) {
    return <div css={{ color: '#666' }}>-</div>;
  }

  const isBackend = field.path === 'backendUrl';

  return (
    <div css={{ marginTop: 8 }}>
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        css={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          backgroundColor: isBackend ? '#2563eb' : '#16a34a',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 500,
          '&:hover': {
            backgroundColor: isBackend ? '#1d4ed8' : '#15803d',
          },
        }}
      >
        {isBackend ? '🔧 Admin' : '🌐 Site'}
        <span css={{ fontSize: 12 }}>↗</span>
      </a>
    </div>
  );
};

export const Cell = ({ field, item }: FieldProps<typeof controller>) => {
  const value = item[field.path];

  if (!value) {
    return <div css={{ color: '#666' }}>-</div>;
  }

  const isBackend = field.path === 'backendUrl';

  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        backgroundColor: isBackend ? '#2563eb' : '#16a34a',
        color: 'white',
        borderRadius: 4,
        textDecoration: 'none',
        fontSize: 12,
        fontWeight: 500,
        '&:hover': {
          backgroundColor: isBackend ? '#1d4ed8' : '#15803d',
        },
      }}
    >
      {isBackend ? '🔧' : '🌐'}
      <span css={{ fontSize: 10 }}>↗</span>
    </a>
  );
};

export const CardValue = ({ field, item }: FieldProps<typeof controller>) => {
  return <Cell field={field} item={item} />;
};

export { controller };

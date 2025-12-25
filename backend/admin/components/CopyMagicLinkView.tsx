/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import { FieldProps } from '@keystone-6/core/types';
import { controller } from '@keystone-6/core/fields/types/text/views';
import { useState } from 'react';

// Get frontend URL from environment or config
const getFrontendUrl = () => {
  if (typeof window !== 'undefined') {
    // In browser, try to infer from current location
    const currentHost = window.location.hostname;
    if (currentHost === 'niche.louije.com' || currentHost.includes('dogbook')) {
      return 'https://www.louije.com';
    }
  }
  return process.env.FRONTEND_URL || 'http://localhost:8080';
};

export const Field = ({ field, value }: FieldProps<typeof controller>) => {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <div css={{ color: '#666' }}>Token will be generated automatically</div>;
  }

  const frontendUrl = getFrontendUrl();
  const magicLink = `${frontendUrl}/?magic=${value}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div css={{ marginTop: 8 }}>
      <div css={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8
      }}>
        <code css={{
          padding: '6px 10px',
          backgroundColor: '#f3f4f6',
          borderRadius: 4,
          fontSize: 13,
          fontFamily: 'monospace',
          color: '#374151',
          border: '1px solid #e5e7eb'
        }}>
          {value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          css={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            backgroundColor: copied ? '#16a34a' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:hover': {
              backgroundColor: copied ? '#15803d' : '#7c3aed',
            },
          }}
        >
          {copied ? '✓ Copié !' : '🔗 Copier le lien'}
        </button>
      </div>
      <div css={{
        fontSize: 12,
        color: '#6b7280',
        fontFamily: 'monospace',
        wordBreak: 'break-all'
      }}>
        {magicLink}
      </div>
    </div>
  );
};

export const Cell = ({ field, item }: FieldProps<typeof controller>) => {
  const [copied, setCopied] = useState(false);
  const value = item[field.path];

  if (!value) {
    return <div css={{ color: '#666' }}>-</div>;
  }

  const frontendUrl = getFrontendUrl();
  const magicLink = `${frontendUrl}/?magic=${value}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        backgroundColor: copied ? '#16a34a' : '#8b5cf6',
        color: 'white',
        border: 'none',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: copied ? '#15803d' : '#7c3aed',
        },
      }}
    >
      {copied ? '✓ Copié' : '🔗 Copier'}
    </button>
  );
};

export const CardValue = ({ field, item }: FieldProps<typeof controller>) => {
  return <Cell field={field} item={item} />;
};

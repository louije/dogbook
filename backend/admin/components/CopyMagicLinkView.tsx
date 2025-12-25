/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import { FieldProps } from '@keystone-6/core/types';
import { controller } from '@keystone-6/core/fields/types/text/views';
import { useState } from 'react';

// Infer frontend URL from admin location
// If admin is on subdomain (e.g., niche.example.com), frontend is on root domain (example.com)
const getFrontendUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    // If on a subdomain, strip it to get the main domain
    const parts = host.split('.');
    if (parts.length > 2) {
      // e.g., niche.example.com -> example.com
      const mainDomain = parts.slice(1).join('.');
      return `${protocol}//${mainDomain}`;
    }
    // Already on main domain or localhost
    return `${protocol}//${host}${window.location.port ? ':' + window.location.port : ''}`;
  }
  return 'http://localhost:8080';
};

export const Field = ({ field, value }: FieldProps<typeof controller>) => {
  const [copied, setCopied] = useState(false);

  // Extract actual string value from Keystone's field value object
  const tokenValue = typeof value === 'string' ? value : value?.inner?.value ?? value?.initial ?? '';

  if (!tokenValue) {
    return <div css={{ color: '#666' }}>Token will be generated automatically</div>;
  }

  const frontendUrl = getFrontendUrl();
  const magicLink = `${frontendUrl}/?magic=${tokenValue}`;

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
          {tokenValue}
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

export { controller };

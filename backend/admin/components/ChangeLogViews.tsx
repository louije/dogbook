/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import { FieldProps } from '@keystone-6/core/types';
import { controller } from '@keystone-6/core/fields/types/json/views';

export const Field = ({ field, value }: FieldProps<typeof controller>) => {
  if (!value || typeof value !== 'object') {
    return <div>Aucun changement</div>;
  }

  const changes = Array.isArray(value) ? value : [];

  if (changes.length === 0) {
    return <div css={{ color: '#666' }}>Aucun changement de champ</div>;
  }

  return (
    <div css={{ marginTop: 8 }}>
      <div css={{
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 8,
        color: '#333'
      }}>
        Changements ({changes.length}):
      </div>
      <div css={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        {changes.map((change: any, index: number) => (
          <div
            key={index}
            css={{
              padding: 12,
              backgroundColor: '#f5f5f5',
              borderRadius: 6,
              borderLeft: '4px solid #2563eb',
            }}
          >
            <div css={{
              fontWeight: 600,
              color: '#2563eb',
              marginBottom: 4,
              fontSize: 13
            }}>
              {change.fieldLabel || change.field}
            </div>
            <div css={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13
            }}>
              <span css={{
                color: '#dc2626',
                textDecoration: 'line-through',
                backgroundColor: '#fee2e2',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {change.displayOld || String(change.oldValue)}
              </span>
              <span css={{ color: '#666' }}>→</span>
              <span css={{
                color: '#16a34a',
                fontWeight: 500,
                backgroundColor: '#dcfce7',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {change.displayNew || String(change.newValue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Cell = ({ field, item }: FieldProps<typeof controller>) => {
  const value = item[field.path];

  if (!value || typeof value !== 'object') {
    return <div>-</div>;
  }

  const changes = Array.isArray(value) ? value : [];

  if (changes.length === 0) {
    return <div css={{ color: '#666' }}>-</div>;
  }

  return (
    <div css={{ fontSize: 13 }}>
      {changes.length} changement{changes.length > 1 ? 's' : ''}
    </div>
  );
};

export const CardValue = ({ field, item }: FieldProps<typeof controller>) => {
  return <Cell field={field} item={item} />;
};

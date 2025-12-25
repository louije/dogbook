import crypto from 'crypto';

/**
 * Access control helpers for Keystone
 */

// Check if user is authenticated (admin)
export const isAuthenticated = ({ session }: any) => !!session;

/**
 * Check if request has a valid magic edit token
 * Validates token from cookie and stores token info in context
 */
export const hasValidEditToken = async ({ context }: any) => {
  // Admins always have access
  if (context.session) return true;

  // Check for magic token in cookie
  const token = context.req?.cookies?.magicToken;
  console.log('[Magic Auth] Cookies:', context.req?.cookies);
  console.log('[Magic Auth] Token from cookie:', token);
  if (!token) return false;

  // Validate token using prisma directly (bypasses access control)
  // This is necessary because EditToken requires authentication to query,
  // but we need to validate the token before the user is authenticated
  const editToken = await context.prisma.editToken.findUnique({
    where: { token },
    select: { id: true, label: true, isActive: true, expiresAt: true, usageCount: true },
  });
  console.log('[Magic Auth] Token lookup result:', editToken);

  if (!editToken) return false;
  if (!editToken.isActive) return false;

  // Check expiration
  if (editToken.expiresAt) {
    const now = new Date();
    const expires = new Date(editToken.expiresAt);
    if (now > expires) return false;
  }

  // Update last used timestamp and increment usage count
  // Do this in background, don't block the request
  context.prisma.editToken.update({
    where: { id: editToken.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: editToken.usageCount + 1,
    },
  }).catch((err: any) => console.error('Failed to update token usage:', err));

  // Store token info in context for change logging
  context.magicToken = {
    id: editToken.id,
    label: editToken.label,
  };

  return true;
};

/**
 * Get the source of the change (admin, magic, or public)
 */
export const getChangedBySource = (context: any): string => {
  if (context.session) return 'admin';
  if (context.magicToken) return 'magic';
  return 'public';
};

/**
 * Get the label/name of who made the change
 */
export const getChangedByLabel = (context: any): string | undefined => {
  if (context.session) return context.session.name;
  if (context.magicToken) return context.magicToken.label;
  return undefined;
};

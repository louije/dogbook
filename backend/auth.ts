import type { Request, Response, NextFunction } from 'express';

const EDITOR_SECRET_PATH = process.env.EDITOR_SECRET_PATH || 'secret-edit';

// Middleware to check for secret URL path
export function secretAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  // If accessing admin UI with secret path, set a session cookie
  if (path.includes(`/${EDITOR_SECRET_PATH}`) || req.cookies?.['secret_access']) {
    // Set a cookie to maintain access
    res.cookie('secret_access', 'true', {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    });

    // Redirect to admin UI if on secret path
    if (path.includes(`/${EDITOR_SECRET_PATH}`) && !path.includes('/api/')) {
      return res.redirect('/');
    }
  }

  next();
}

// Check if user has access (either through secret or session)
export function hasAccess(req: Request): boolean {
  return !!req.cookies?.['secret_access'] || !!req.session;
}

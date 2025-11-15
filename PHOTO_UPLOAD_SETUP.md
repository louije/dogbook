# Photo Upload & Moderation Setup Guide

This guide explains how to set up and use the new mobile photo upload and moderation features.

## Features

### 1. Mobile Photo Upload
- Upload photos directly from dog detail pages
- Works on mobile with camera integration
- Client-side image compression (reduces file size by ~50-70%)
- Progress indicator and error handling
- Mobile-optimized UI with large touch targets

### 2. Photo Moderation System
- **A posteriori mode** (default): Photos are published immediately, you get notified after
- **A priori mode**: Photos must be approved before being visible on the site
- Toggle between modes in the admin Settings

### 3. Featured Photo Selection
- Users can select which photo becomes the main one
- Star button on each gallery photo
- Updates immediately (requires page reload)

### 4. Push Notifications
- Get notified on iOS when new photos are uploaded
- Uses Web Push API (Safari/iOS 16.4+)
- No external services required

## Setup Instructions

### Step 1: Generate VAPID Keys

VAPID keys are required for push notifications.

```bash
cd backend
npx web-push generate-vapid-keys
```

This will output something like:
```
Public Key: BEL...abc123
Private Key: xyz...456def
```

### Step 2: Update Backend Environment

Edit `backend/.env` and add the VAPID keys:

```env
# Web Push Notifications
VAPID_PUBLIC_KEY=BEL...abc123
VAPID_PRIVATE_KEY=xyz...456def
VAPID_SUBJECT=mailto:youremail@example.com
```

### Step 3: Update Frontend JavaScript

Edit `frontend/src/js/push-notifications.js` and replace the placeholder:

```javascript
const VAPID_PUBLIC_KEY = 'BEL...abc123'; // Your actual public key here
```

### Step 4: Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Step 5: Run Database Migration

The new schema includes Settings, PushSubscription, and Media status fields.

```bash
cd backend
npm run dev
# Keystone will detect schema changes and create/update tables automatically
```

### Step 6: Configure Moderation Mode

1. Start the backend: `npm run dev`
2. Log in to admin at http://localhost:3000
3. Go to "Settings" (Paramètres)
4. Choose your moderation mode:
   - **A posteriori**: Photos published immediately (default)
   - **A priori**: Photos require approval

## Using the Features

### For Regular Users

#### Uploading Photos

1. Navigate to any dog's detail page
2. Scroll to the "Ajouter une photo" section
3. Tap "Choisir une photo"
   - On mobile: Can take a new photo or choose from gallery
   - On desktop: Select a file
4. Preview shows compressed image with size reduction
5. Tap "Envoyer" to upload
6. Progress bar shows upload status
7. Success message confirms upload

#### Setting Featured Photo

1. On a dog's detail page, look at the photo gallery sidebar
2. Each photo has a star (⭐) button
3. Tap the star on the photo you want as main
4. Confirm the action
5. Page reloads with the new featured photo

### For Admins

#### Approving Photos (A Priori Mode)

1. Receive push notification on iOS
2. Open admin panel
3. Go to "Médias"
4. Filter by Status: "En attente" (Pending)
5. Review each photo
6. Set Status to:
   - "Approuvée" ✅ to publish
   - "Rejetée" ❌ to reject
7. Frontend rebuilds automatically with approved photos

#### Reviewing Photos (A Posteriori Mode)

1. Receive notification that photo was published
2. Review in admin if needed
3. Can reject/delete inappropriate photos

#### Managing Moderation Mode

1. Go to Settings in admin
2. Toggle between:
   - **A posteriori** (publish then notify)
   - **A priori** (approve before publish)
3. Change takes effect immediately for new uploads

## Setting Up Push Notifications (iOS)

### For Admins on iOS Safari:

1. Visit the site on iOS Safari
2. Add to Home Screen:
   - Tap Share button
   - Tap "Add to Home Screen"
   - Name it "Dogbook Admin" or similar
3. Open the app from home screen
4. Open browser console (if using desktop Safari with remote debugging) or add a button to enable notifications
5. Run: `window.enablePushNotifications()`
6. Allow notifications when prompted
7. You'll now receive push notifications for new uploads!

### Alternative: Add Enable Button

You can add a button in the admin UI to enable notifications:

```html
<button onclick="window.enablePushNotifications()">
  Enable Notifications
</button>
```

## Troubleshooting

### Photos Not Showing After Upload

**Issue**: Uploaded photo not visible in gallery
**Solution**: Check the status in admin:
- If status is "Pending", approve it (or switch to a posteriori mode)
- Rebuild frontend: `cd frontend && npm run build`
- Check CORS settings if uploading from different domain

### Push Notifications Not Working

**Issue**: Not receiving notifications
**Solution**:
1. Check VAPID keys are set correctly in backend `.env`
2. Check VAPID public key is updated in `push-notifications.js`
3. Verify you've enabled notifications: `window.enablePushNotifications()`
4. Check browser console for errors
5. Ensure you're using Safari on iOS 16.4+ or desktop Safari 16+

### Image Upload Fails

**Issue**: Error when uploading photo
**Solution**:
1. Check file is a valid image (JPG, PNG, etc.)
2. Check network connection
3. Check backend is running and accessible
4. Look in browser console for specific error
5. Check backend logs for GraphQL errors

### Image Too Large

**Issue**: Upload takes too long
**Solution**:
- Client-side compression should handle this automatically
- If issues persist, reduce MAX_WIDTH/MAX_HEIGHT in `upload.js`
- Current limits: 1920x1920px, 85% JPEG quality

## Technical Details

### File Upload Flow

1. User selects image file
2. JavaScript reads file
3. Canvas API compresses image:
   - Maintains aspect ratio
   - Resizes to max 1920x1920
   - Converts to JPEG at 85% quality
   - Typical compression: 50-70% size reduction
4. Shows preview with compression stats
5. On submit:
   - Creates GraphQL multipart request
   - Uploads compressed blob
   - Server saves to local storage
   - Returns media ID and status
6. Database record created with:
   - File reference
   - Status (based on moderation mode)
   - Timestamp
   - Dog relationship
7. Notification sent to admins
8. Frontend rebuilds (if auto-approved)

### Push Notification Flow

1. Admin enables push on their device
2. Browser requests permission
3. Service worker registered
4. Push subscription created with VAPID keys
5. Subscription saved to database
6. When photo uploaded:
   - Backend checks moderation mode
   - Sends push to all subscriptions
   - Service worker displays notification
7. Clicking notification opens admin panel

### Media Status States

- **pending** ⏳: Awaiting approval (a priori mode)
- **approved** ✅: Published and visible
- **rejected** ❌: Not published (admin rejected)

## Performance Notes

- Image compression happens client-side (no server load)
- Typical 3MB photo compresses to ~500KB
- Upload time on 4G: ~2-3 seconds
- Frontend only fetches approved photos (faster builds)
- Service worker caches static assets

## Security Considerations

- Anyone can upload photos (by design)
- Moderation prevents spam from appearing
- Rate limiting recommended (can add in future)
- VAPID keys should be kept secret
- Push subscriptions are per-device
- File type validation on upload
- GraphQL handles authentication for approval actions

## Future Enhancements

Possible improvements:
- [ ] Rate limiting per IP
- [ ] CAPTCHA on upload form
- [ ] Batch approval in admin
- [ ] Email notifications as fallback
- [ ] Image rotation/cropping before upload
- [ ] Multiple photo upload at once
- [ ] Photo tagging/categories
- [ ] Admin notification digest (daily summary)

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Check backend logs: `cd backend && npm run dev`
4. Test in different browser
5. Verify all environment variables are set

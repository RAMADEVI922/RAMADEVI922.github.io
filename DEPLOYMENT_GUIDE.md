# GitHub Pages Deployment Guide - QR Menu

## Overview
This project is deployed on GitHub Pages at: https://ramadevi922.github.io/QRMENU/

## Configuration Summary

### 1. Vite Configuration (`vite.config.ts`)
- **Base Path**: `/QRMENU/` - Matches the GitHub repository name
- This ensures all assets are loaded from the correct subdirectory

### 2. React Router Configuration (`src/App.tsx`)
- **BrowserRouter basename**: `/QRMENU/`
- This tells React Router that all routes are under the `/QRMENU/` subdirectory

### 3. GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- Automatically builds and deploys on every push to `main` branch
- Uses `peaceiris/actions-gh-pages@v3` for reliable deployment
- Publishes the `dist` folder to GitHub Pages

### 4. SPA Routing Solutions

#### Service Worker (`public/sw.js`)
- Intercepts navigation requests
- Serves `index.html` for any 404 errors
- Enables page refresh without 404 errors

#### 404 Redirect (`public/404.html`)
- Fallback redirect for browsers without service worker support
- Redirects to `index.html` while preserving the original path

#### .nojekyll File (`public/.nojekyll`)
- Prevents GitHub Pages from processing the site as Jekyll
- Ensures all files are served as-is

## How to Deploy Updates

### Step 1: Make Changes Locally
```bash
cd pro/QR-menu-org
# Make your code changes
```

### Step 2: Test Locally
```bash
npm run dev
# Test your changes at http://localhost:8080
```

### Step 3: Commit and Push
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Step 4: Wait for Deployment
- GitHub Actions will automatically trigger
- Deployment typically completes in 2-5 minutes
- Check the "Actions" tab in your GitHub repository to monitor progress

### Step 5: Verify Deployment
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Visit https://ramadevi922.github.io/QRMENU/
3. Test navigation and page refresh

## Troubleshooting

### Issue: Changes not appearing on GitHub Pages
**Solution:**
1. Verify the build succeeded in GitHub Actions (check "Actions" tab)
2. Hard refresh your browser (Ctrl+Shift+R)
3. Clear browser cache if needed
4. Wait 5 minutes for CDN cache to clear

### Issue: 404 error when refreshing a page
**Solution:**
1. Hard refresh the page (Ctrl+Shift+R)
2. Wait for service worker to register (first visit may take a moment)
3. If still failing, check browser console for service worker errors

### Issue: Service worker not registering
**Solution:**
1. Check browser console for errors
2. Ensure you're using HTTPS (GitHub Pages uses HTTPS)
3. Clear browser cache and service worker cache:
   - DevTools → Application → Service Workers → Unregister
   - DevTools → Application → Cache Storage → Delete all

## File Structure

```
pro/QR-menu-org/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions workflow
├── public/
│   ├── sw.js                   # Service worker for SPA routing
│   ├── 404.html                # 404 redirect page
│   ├── .nojekyll               # Prevents Jekyll processing
│   └── favicon.ico
├── src/
│   ├── App.tsx                 # BrowserRouter with basename
│   ├── pages/                  # Page components
│   └── ...
├── vite.config.ts              # Base path configuration
├── index.html                  # Service worker registration
└── package.json                # Build scripts
```

## Key Configuration Files

### vite.config.ts
```typescript
export default defineConfig(({ mode }) => ({
  base: "/QRMENU/",  // Must match repository name
  // ... other config
}));
```

### src/App.tsx
```typescript
<BrowserRouter basename="/QRMENU/">
  <Routes>
    {/* Your routes */}
  </Routes>
</BrowserRouter>
```

### index.html
```html
<script type="text/javascript">
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/QRMENU/sw.js');
  }
</script>
```

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Run tests
npm run test

# Lint code
npm run lint
```

## Important Notes

1. **Always use the correct base path** (`/QRMENU/`) in all configurations
2. **Service worker requires HTTPS** - GitHub Pages uses HTTPS automatically
3. **First visit may be slow** - Service worker needs to cache files
4. **Hard refresh is important** - Browser cache can hide updates
5. **GitHub Actions must succeed** - Check the Actions tab if deployment fails

## Support

For issues with GitHub Pages deployment:
1. Check GitHub Actions logs for build errors
2. Verify all configuration files have the correct base path
3. Clear browser cache and service worker cache
4. Hard refresh the page (Ctrl+Shift+R)
5. Wait 5 minutes for CDN cache to clear

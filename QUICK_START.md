# Quick Start - Deploy Updates to GitHub Pages

## For Every Update

### 1. Make Changes
```bash
cd pro/QR-menu-org
# Edit your files
```

### 2. Test Locally
```bash
npm run dev
# Visit http://localhost:8080 and test
```

### 3. Deploy
```bash
git add .
git commit -m "Your message"
git push origin main
```

### 4. Wait & Verify
- Wait 2-5 minutes for GitHub Actions to deploy
- Hard refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
- Visit: https://ramadevi922.github.io/QRMENU/

## Verify Deployment Status

1. Go to: https://github.com/RAMADEVI922/QRMENU
2. Click "Actions" tab
3. Check if the latest workflow shows ✅ (green checkmark)

## If Updates Don't Appear

1. **Hard refresh** (Ctrl+Shift+R)
2. **Clear cache**: DevTools → Application → Cache Storage → Delete all
3. **Unregister service worker**: DevTools → Application → Service Workers → Unregister
4. **Wait 5 minutes** for CDN cache to clear
5. **Hard refresh again**

## If You Get 404 on Page Refresh

1. Hard refresh (Ctrl+Shift+R)
2. Wait for service worker to register (first visit takes a moment)
3. Try again

## Build Locally (Optional)

```bash
npm run build
npm run preview
# Visit http://localhost:4173 to preview production build
```

## Key Points

✅ Base path is `/QRMENU/` (matches repository name)
✅ React Router is configured with basename `/QRMENU/`
✅ Service worker handles 404 redirects
✅ GitHub Actions auto-deploys on push to main
✅ All files are in the correct locations

## Deployed Site

🌐 https://ramadevi922.github.io/QRMENU/

## Repository

📦 https://github.com/RAMADEVI922/QRMENU

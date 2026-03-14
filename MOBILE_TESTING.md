# Mobile Testing Guide

## Quick Test URLs

Try these URLs directly in your mobile browser:

1. **Home Page**: https://qr-menu-19cd1.web.app/
2. **Table 1 Menu**: https://qr-menu-19cd1.web.app/menu/T1
3. **Waiter Panel**: https://qr-menu-19cd1.web.app/waiter

## What You Should See

### Home Page (/)
- Welcome screen
- Options to select role (Customer/Waiter/Admin)

### Menu Page (/menu/T1)
- Restaurant menu with categories
- Food items with prices
- Add to cart buttons
- Cart icon at bottom

### Waiter Panel (/waiter)
- List of pending orders
- Notification bell
- Order management buttons

## Troubleshooting Steps

### If you see a blank white page:

1. **Clear browser cache**
   - Chrome: Settings → Privacy → Clear browsing data
   - Safari: Settings → Safari → Clear History and Website Data

2. **Try incognito/private mode**
   - This bypasses cache issues

3. **Check browser console**
   - Chrome: Menu → More tools → Developer tools → Console
   - Look for red error messages

4. **Try different browser**
   - Chrome
   - Safari
   - Firefox
   - Edge

### If QR code doesn't work:

1. **Verify QR code URL**
   - Scan QR code
   - Check the URL it opens
   - Should be: `https://qr-menu-19cd1.web.app/menu/T1` (or T2, T3, etc.)

2. **Test URL directly**
   - Type the URL manually in browser
   - If it works, QR code is wrong
   - If it doesn't work, app has issues

3. **Regenerate QR code**
   - Use correct URL format
   - Test new QR code

### If you see "Page Not Found":

1. **Check URL format**
   - Correct: `https://qr-menu-19cd1.web.app/menu/T1`
   - Wrong: `https://qr-menu-19cd1.web.app/QRMENU/menu/T1`

2. **Wait 5 minutes**
   - Firebase deployment can take a few minutes to propagate

3. **Hard refresh**
   - Chrome: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Safari: Cmd+Option+R

## Network Issues

### Check internet connection:
- Open https://google.com to verify internet works
- Try switching between WiFi and mobile data

### Check Firebase status:
- Visit: https://status.firebase.google.com/
- Ensure all services are operational

## Browser Compatibility

### Supported Browsers:
- ✅ Chrome (Android/iOS) - Recommended
- ✅ Safari (iOS) - Recommended
- ✅ Firefox (Android/iOS)
- ✅ Edge (Android/iOS)
- ✅ Samsung Internet (Android)

### Minimum Versions:
- Chrome 90+
- Safari 14+
- Firefox 88+

## Still Not Working?

### Collect Debug Information:

1. **Screenshot the error**
2. **Note the exact URL you're trying**
3. **Check browser console for errors**
4. **Try on different device**
5. **Note your mobile OS and browser version**

### Common Issues:

**Issue**: Blank white page
**Solution**: Clear cache, try incognito mode

**Issue**: "Cannot GET /menu/T1"
**Solution**: Wait 5 minutes for deployment, hard refresh

**Issue**: QR code opens wrong URL
**Solution**: Regenerate QR code with correct URL

**Issue**: Menu loads but no items
**Solution**: Check Firebase configuration in .env.local

**Issue**: Can't place order
**Solution**: Check internet connection, verify Firebase is configured

## Testing Checklist

- [ ] Home page loads
- [ ] Menu page loads with items
- [ ] Can add items to cart
- [ ] Can view cart
- [ ] Can place order
- [ ] Order appears in waiter panel
- [ ] Can update order status
- [ ] Notifications work

## Contact Support

If none of these solutions work, provide:
1. Mobile device model and OS version
2. Browser name and version
3. Screenshot of error
4. URL you're trying to access
5. What you see on screen

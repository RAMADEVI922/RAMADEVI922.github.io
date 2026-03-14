# QR Code Setup Guide

## Issue Fixed
QR codes were not opening the menu because the app had incorrect base paths configured for production.

## Changes Made
- Updated `vite.config.ts` to use `/` for production and `/QRMENU/` for local dev
- Updated `src/main.tsx` to use environment-aware basename

## Correct URLs for QR Codes

### Customer Menu URLs (for QR codes)
Generate QR codes for these URLs:

- **Table 1**: `https://qr-menu-19cd1.web.app/menu/T1`
- **Table 2**: `https://qr-menu-19cd1.web.app/menu/T2`
- **Table 3**: `https://qr-menu-19cd1.web.app/menu/T3`
- **Table 4**: `https://qr-menu-19cd1.web.app/menu/T4`
- **Table 5**: `https://qr-menu-19cd1.web.app/menu/T5`
- **Table 6**: `https://qr-menu-19cd1.web.app/menu/T6`

### Staff URLs (no QR code needed)
- **Waiter Panel**: `https://qr-menu-19cd1.web.app/waiter`
- **Admin Panel**: `https://qr-menu-19cd1.web.app/admin`
- **Home**: `https://qr-menu-19cd1.web.app/`

## How to Generate QR Codes

### Option 1: Online QR Code Generator
1. Go to https://www.qr-code-generator.com/ or https://qrcode.tec-it.com/
2. Select "URL" type
3. Enter the table URL (e.g., `https://qr-menu-19cd1.web.app/menu/T1`)
4. Customize design if needed
5. Download as PNG or SVG
6. Print and place on table

### Option 2: Using Node.js Script
Create a file `generate-qr-codes.js`:

```javascript
const QRCode = require('qrcode');
const fs = require('fs');

const baseUrl = 'https://qr-menu-19cd1.web.app/menu/';
const tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

tables.forEach(async (table) => {
  const url = baseUrl + table;
  const filename = `qr-code-${table}.png`;
  
  await QRCode.toFile(filename, url, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  
  console.log(`Generated ${filename}`);
});
```

Install and run:
```bash
npm install qrcode
node generate-qr-codes.js
```

### Option 3: Using Python
```python
import qrcode

base_url = 'https://qr-menu-19cd1.web.app/menu/'
tables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']

for table in tables:
    url = base_url + table
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(f'qr-code-{table}.png')
    print(f'Generated qr-code-{table}.png')
```

## QR Code Design Tips

1. **Size**: Print at least 2x2 inches (5x5 cm) for easy scanning
2. **Placement**: Place on table in visible location
3. **Protection**: Laminate or use acrylic stand to protect from spills
4. **Branding**: Add restaurant logo/name above QR code
5. **Instructions**: Add text like "Scan to view menu & order"

## Testing QR Codes

1. Generate QR code for Table 1
2. Scan with phone camera
3. Should open: `https://qr-menu-19cd1.web.app/menu/T1`
4. Menu should load with items
5. Add items to cart and place order
6. Check waiter panel to see order appear

## Troubleshooting

### QR Code Not Scanning
- Ensure good lighting
- Clean camera lens
- Hold phone steady
- Try different QR code generator

### Wrong Page Opens
- Verify URL in QR code matches format above
- Check for typos in table ID
- Ensure app is deployed to Firebase

### Menu Not Loading
- Check internet connection
- Verify Firebase configuration
- Check browser console for errors

## Adding More Tables

To add more tables:
1. Generate QR code with URL: `https://qr-menu-19cd1.web.app/menu/T7` (or T8, T9, etc.)
2. Add table in Admin Panel → Table Management
3. Print and place QR code

The table ID in the URL must match the table ID in your system.

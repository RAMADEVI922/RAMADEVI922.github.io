import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log("Starting script...");
  const dummyImagePath = path.join(__dirname, 'dummy.png');
  fs.writeFileSync(dummyImagePath, 'fake image data');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen to console and network
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
  page.on('requestfailed', request => {
    console.log('REQUEST_FAILED:', request.url(), request.failure()?.errorText);
  });

  console.log("Navigating to http://localhost:5173/admin/menu...");
  await page.goto('http://localhost:5173/admin/menu', { waitUntil: 'networkidle' });

  await page.waitForTimeout(2000);

  console.log("Clicking Add Item...");
  await page.click('button:has-text("Add Item")');
  
  await page.waitForTimeout(1000);

  console.log("Setting input file...");
  const fileInputs = await page.$$('input[type="file"]');
  if (fileInputs.length > 0) {
    // Usually the second input in the file since there is a category upload input as well. Let's set both to be safe or just the last one.
    await fileInputs[fileInputs.length - 1].setInputFiles(dummyImagePath);
  }

  await page.waitForTimeout(1000);

  console.log("Filling form...");
  await page.fill('input[placeholder="e.g. Truffle Fries"]', 'Test Name');
  await page.fill('input[placeholder="e.g. 299"]', '10');
  await page.fill('input[placeholder="e.g. Starters"]', 'Test Category');

  console.log("Clicking Create Item...");
  await page.click('button:has-text("Create Item")');

  console.log("Waiting 5 seconds...");
  await page.waitForTimeout(5000);

  console.log("Closing browser...");
  await browser.close();
  fs.unlinkSync(dummyImagePath);
})();

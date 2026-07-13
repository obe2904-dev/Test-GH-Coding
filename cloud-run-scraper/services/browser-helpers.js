/**
 * Browser Helpers - Phase 5 Execution Order
 * 
 * CRITICAL: These must execute in exact order:
 * 5a: dismissCookieDialog
 * 5b: removeKnownNoise
 * 5c: autoScroll
 * 5d: waitForContentStability
 * 5e: extractPageDocument (in dom-extractor.js)
 */

/**
 * Phase 5a: Dismiss cookie/consent dialog
 * Must run BEFORE content extraction as dialogs can block rendering
 * @param {import('puppeteer').Page} page
 */
export async function dismissCookieDialog(page) {
  const buttonTexts = [
    'afvis alle',
    'afvis',
    'kun nødvendige',
    'reject all',
    'decline',
    'necessary only',
    'accepter alle',
    'acceptér alle',
    'accept all'
  ];

  try {
    await page.evaluate((texts) => {
      const elements = [
        ...document.querySelectorAll(
          'button, [role="button"], input[type="button"], input[type="submit"]'
        )
      ];

      for (const element of elements) {
        const text = (
          element.innerText ||
          element.value ||
          element.getAttribute('aria-label') ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        if (texts.some(candidate => text === candidate || text.includes(candidate))) {
          element.click();
          return true;
        }
      }
      return false;
    }, buttonTexts);

    // Allow overlay animation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (err) {
    console.warn('dismissCookieDialog failed:', err?.message);
  }
}

/**
 * Phase 5b: Remove known noise containers
 * Must run BEFORE extraction to prevent cookie/tracking content in results
 * @param {import('puppeteer').Page} page
 */
export async function removeKnownNoise(page) {
  const noiseSelectors = [
    'script',
    'style',
    'noscript',
    'svg',
    'template',
    'iframe',
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[id*="consent" i]',
    '[class*="consent" i]',
    '[id*="onetrust" i]',
    '[class*="onetrust" i]',
    '[id*="cookiebot" i]',
    '[class*="cookiebot" i]',
    '[id*="usercentrics" i]',
    '[class*="usercentrics" i]',
    '[aria-label*="cookie" i]',
    '[data-nosnippet]'
  ];

  try {
    await page.evaluate((selectors) => {
      for (const selector of selectors) {
        document
          .querySelectorAll(selector)
          .forEach(element => element.remove());
      }
    }, noiseSelectors);
  } catch (err) {
    console.warn('removeKnownNoise failed:', err?.message);
  }
}

/**
 * Phase 5c: Auto-scroll to trigger lazy-loaded content
 * Must run BEFORE extraction so lazy sections have non-zero bounding rects
 * @param {import('puppeteer').Page} page
 */
export async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      const STEP = 400;       // pixels per scroll step
      const DELAY = 150;      // ms between steps

      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Null safety: check if body exists
      if (!document.body) {
        console.warn('[autoScroll] document.body is null, skipping scroll');
        return;
      }

      const maxScroll = document.body.scrollHeight;
      let current = 0;

      while (current < maxScroll) {
        window.scrollBy(0, STEP);
        current += STEP;
        await sleep(DELAY);
      }

      // Return to top so above-fold content is accessible
      window.scrollTo(0, 0);
    });
  } catch (err) {
    console.warn('autoScroll failed:', err?.message);
  }
}

/**
 * Phase 5d: Wait for content stability
 * Poll innerText.length until it stops growing (hydration complete)
 * @param {import('puppeteer').Page} page
 * @param {object} options
 */
export async function waitForContentStability(page, options = {}) {
  const {
    intervalMs = 300,
    maxWaitMs = 5000,
    requiredStableChecks = 2
  } = options;

  try {
    await page.evaluate(async ({ intervalMs, maxWaitMs, requiredStableChecks }) => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const deadline = Date.now() + maxWaitMs;
      let stableCount = 0;
      let lastLength = 0;

      while (Date.now() < deadline) {
        await sleep(intervalMs);
        const current = document.body?.innerText?.length ?? 0;

        if (current === lastLength) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            return;
          }
        } else {
          stableCount = 0;
          lastLength = current;
        }
      }
    }, { intervalMs, maxWaitMs, requiredStableChecks });
  } catch (err) {
    console.warn('waitForContentStability failed:', err?.message);
  }
}

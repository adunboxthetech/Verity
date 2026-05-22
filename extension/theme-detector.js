(() => {
  // Prevent duplicate execution
  if (window.__aiFactCheckerThemeDetectorLoaded) return;
  window.__aiFactCheckerThemeDetectorLoaded = true;

  function detectAndSendTheme() {
    // 1. Check system media query preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = prefersDark;
    
    try {
      const getLuminance = (colorStr) => {
        if (!colorStr || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'transparent') {
          return null;
        }
        // Extract R, G, B values
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          // Standard relative luminance formula
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        return null;
      };

      const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
      const htmlLum = getLuminance(htmlBg);

      let bodyLum = null;
      let bodyTextLum = null;
      if (document.body) {
        const bodyStyle = window.getComputedStyle(document.body);
        bodyLum = getLuminance(bodyStyle.backgroundColor);
        bodyTextLum = getLuminance(bodyStyle.color);
      }

      // Use body background luminance if available, otherwise html background
      const lum = bodyLum !== null ? bodyLum : htmlLum;
      if (lum !== null) {
        isDark = lum < 128; // luminance < 128 means a dark background
      } else if (bodyTextLum !== null) {
        // Fallback: If background is transparent/not set, check text color.
        // If text color is light (luminance >= 128), background is likely dark.
        // If text color is dark (luminance < 128), background is likely light.
        isDark = bodyTextLum >= 128;
      }
    } catch (e) {
      console.error("[AI Fact Checker] Theme detection error:", e);
    }
    
    // Send message to background script
    chrome.runtime.sendMessage({ type: "PAGE_THEME_DETECTED", isDark }).catch((err) => {
      // Ignore errors when extension context is invalidated (e.g. extension updated/reloaded)
    });
  }

  // Run theme detection at different stages of page load
  detectAndSendTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectAndSendTheme);
  } else {
    detectAndSendTheme();
  }

  window.addEventListener('load', detectAndSendTheme);

  // Listen for prefers-color-scheme changes at the OS/Browser level
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  try {
    mediaQuery.addEventListener('change', detectAndSendTheme);
  } catch (e) {
    mediaQuery.addListener(detectAndSendTheme);
  }

  // Set up a MutationObserver to handle dynamic theme changes on Single Page Applications (SPAs)
  let observer;
  try {
    observer = new MutationObserver(() => {
      detectAndSendTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme']
    });
    
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style', 'class']
          });
        }
      });
    }
  } catch (e) {
    console.error("[AI Fact Checker] MutationObserver setup failed:", e);
  }
})();

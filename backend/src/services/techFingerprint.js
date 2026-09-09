const cheerio = require('cheerio');

/**
 * Known technology definitions for passive fingerprinting
 */
const TECH_CATALOG = [
  // CMS
  {
    name: 'WordPress',
    ecosystem: 'Packagist',
    category: 'cms',
    rules: [
      {
        type: 'meta',
        name: 'generator',
        pattern: /WordPress\s*([0-9]+(?:\.[0-9]+)+)?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /wp-emoji-release\.min\.js\?ver=([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /\/wp-content\/|\/wp-includes\/|\/wp-json\//i,
        confidence: 'medium'
      },
      {
        type: 'header',
        name: 'x-powered-by',
        pattern: /WordPress/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Shopify',
    category: 'cms',
    rules: [
      {
        type: 'html',
        pattern: /cdn\.shopify\.com|shopify-section/i,
        confidence: 'high'
      },
      {
        type: 'meta',
        name: 'generator',
        pattern: /Shopify/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Wix',
    category: 'cms',
    rules: [
      {
        type: 'html',
        pattern: /wix\.com|wixpress\.com/i,
        confidence: 'high'
      },
      {
        type: 'meta',
        name: 'generator',
        pattern: /Wix\.com\s*Website\s*Builder/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Squarespace',
    category: 'cms',
    rules: [
      {
        type: 'html',
        pattern: /static\.squarespace\.com|squarespace-config/i,
        confidence: 'high'
      },
      {
        type: 'meta',
        name: 'generator',
        pattern: /Squarespace/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Webflow',
    category: 'cms',
    rules: [
      {
        type: 'html',
        pattern: /data-wf-page|data-wf-site|assets\.website-files\.com/i,
        confidence: 'high'
      },
      {
        type: 'meta',
        name: 'generator',
        pattern: /Webflow/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Joomla',
    ecosystem: 'Packagist',
    category: 'cms',
    rules: [
      {
        type: 'meta',
        name: 'generator',
        pattern: /Joomla!\s*-\s*Open\s*Source\s*Content\s*Management(?:\s*-\s*Version\s*([0-9]+(?:\.[0-9]+)+))?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'meta',
        name: 'generator',
        pattern: /Joomla!?\s*([0-9]+(?:\.[0-9]+)+)?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /\/media\/jui\/|\/media\/system\/js\//i,
        confidence: 'medium'
      }
    ]
  },
  {
    name: 'Drupal',
    ecosystem: 'Packagist',
    category: 'cms',
    rules: [
      {
        type: 'meta',
        name: 'generator',
        pattern: /Drupal\s*([0-9]+(?:\.[0-9]+)*)?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'header',
        name: 'x-drupal-cache',
        pattern: /.*/,
        confidence: 'high'
      },
      {
        type: 'header',
        name: 'x-generator',
        pattern: /Drupal\s*([0-9]+(?:\.[0-9]+)*)?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /Drupal\.settings|drupal\.js/i,
        confidence: 'medium'
      }
    ]
  },

  // Frameworks
  {
    name: 'Next.js',
    ecosystem: 'npm',
    packageName: 'next',
    category: 'framework',
    rules: [
      {
        type: 'header',
        name: 'x-powered-by',
        pattern: /Next\.js\s*([0-9]+(?:\.[0-9]+)+)?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /__NEXT_DATA__|\/_next\/static\//i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'React',
    ecosystem: 'npm',
    packageName: 'react',
    category: 'framework',
    rules: [
      {
        type: 'scriptSrc',
        pattern: /react(?:-dom)?(?:\.production|\.development)?(?:\.min)?\.js(?:\?ver=([0-9]+(?:\.[0-9]+)+))?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /react@([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /data-reactroot|data-reactid|__NEXT_DATA__/i,
        confidence: 'medium'
      }
    ]
  },
  {
    name: 'Vue',
    ecosystem: 'npm',
    packageName: 'vue',
    category: 'framework',
    rules: [
      {
        type: 'scriptSrc',
        pattern: /vue(?:\.runtime)?(?:\.global)?(?:\.prod|\.min)?\.js(?:\?ver=([0-9]+(?:\.[0-9]+)+))?/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /vue@([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /data-v-[a-f0-9]+|__NUXT__/i,
        confidence: 'medium'
      }
    ]
  },
  {
    name: 'Angular',
    ecosystem: 'npm',
    packageName: '@angular/core',
    category: 'framework',
    rules: [
      {
        type: 'html',
        pattern: /ng-version="([0-9]+(?:\.[0-9]+)+)"/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /ng-app|ng-binding|_nghost|_ngcontent/i,
        confidence: 'medium'
      }
    ]
  },
  {
    name: 'Laravel',
    ecosystem: 'Packagist',
    packageName: 'laravel/framework',
    category: 'framework',
    rules: [
      {
        type: 'header',
        name: 'set-cookie',
        pattern: /laravel_session=/i,
        confidence: 'high'
      },
      {
        type: 'header',
        name: 'x-powered-by',
        pattern: /Laravel/i,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /name="csrf-token"|content="[a-zA-Z0-9]{40}"/i,
        confidence: 'low'
      }
    ]
  },
  {
    name: 'Django',
    ecosystem: 'PyPI',
    packageName: 'django',
    category: 'framework',
    rules: [
      {
        type: 'header',
        name: 'set-cookie',
        pattern: /csrftoken=/i,
        confidence: 'medium'
      },
      {
        type: 'html',
        pattern: /name=['"]csrfmiddlewaretoken['"]/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Express',
    ecosystem: 'npm',
    packageName: 'express',
    category: 'framework',
    rules: [
      {
        type: 'header',
        name: 'x-powered-by',
        pattern: /^Express$/i,
        confidence: 'high'
      }
    ]
  },

  // Libraries
  {
    name: 'jQuery',
    ecosystem: 'npm',
    packageName: 'jquery',
    category: 'libraries',
    rules: [
      {
        type: 'scriptSrc',
        pattern: /jquery[-.]([0-9]+(?:\.[0-9]+)+)(?:\.min|\.slim)?\.js/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /jquery(?:\.min)?\.js\?ver=([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /jquery@([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /jquery(?:\.min)?\.js/i,
        confidence: 'medium'
      }
    ]
  },
  {
    name: 'Bootstrap',
    ecosystem: 'npm',
    packageName: 'bootstrap',
    category: 'libraries',
    rules: [
      {
        type: 'scriptSrc',
        pattern: /bootstrap(?:\.bundle)?[-.]([0-9]+(?:\.[0-9]+)+)(?:\.min)?\.js/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /bootstrap\/([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /bootstrap@([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'html',
        pattern: /bootstrap(?:\.min)?\.(?:css|js)/i,
        confidence: 'medium'
      }
    ]
  },
  {
    name: 'Lodash',
    ecosystem: 'npm',
    packageName: 'lodash',
    category: 'libraries',
    rules: [
      {
        type: 'scriptSrc',
        pattern: /lodash(?:[-.]([0-9]+(?:\.[0-9]+)+))?(?:\.min)?\.js/i,
        versionGroup: 1,
        confidence: 'high'
      },
      {
        type: 'scriptSrc',
        pattern: /lodash@([0-9]+(?:\.[0-9]+)+)/i,
        versionGroup: 1,
        confidence: 'high'
      }
    ]
  },

  // Servers
  {
    name: 'nginx',
    category: 'server',
    rules: [
      {
        type: 'header',
        name: 'server',
        pattern: /nginx(?:\/([0-9]+(?:\.[0-9]+)+))?/i,
        versionGroup: 1,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Apache',
    category: 'server',
    rules: [
      {
        type: 'header',
        name: 'server',
        pattern: /Apache(?:\/([0-9]+(?:\.[0-9]+)+))?/i,
        versionGroup: 1,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Cloudflare',
    category: 'server',
    rules: [
      {
        type: 'header',
        name: 'server',
        pattern: /cloudflare/i,
        confidence: 'high'
      },
      {
        type: 'header',
        name: 'cf-ray',
        pattern: /.+/,
        confidence: 'high'
      },
      {
        type: 'header',
        name: 'set-cookie',
        pattern: /__cf_bm=/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'PHP',
    category: 'server',
    rules: [
      {
        type: 'header',
        name: 'x-powered-by',
        pattern: /PHP(?:\/([0-9]+(?:\.[0-9]+)+))?/i,
        versionGroup: 1,
        confidence: 'high'
      }
    ]
  },

  // Analytics
  {
    name: 'Google Analytics',
    category: 'analytics',
    rules: [
      {
        type: 'html',
        pattern: /google-analytics\.com\/analytics\.js|googletagmanager\.com\/gtag\/js|googletagmanager\.com\/gtm\.js/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Facebook Pixel',
    category: 'analytics',
    rules: [
      {
        type: 'html',
        pattern: /connect\.facebook\.net\/[a-z_]+\/fbevents\.js/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    rules: [
      {
        type: 'html',
        pattern: /static\.hotjar\.com\/c\/hotjar-/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Mixpanel',
    category: 'analytics',
    rules: [
      {
        type: 'html',
        pattern: /cdn\.mxpnl\.com\/libs\/mixpanel/i,
        confidence: 'high'
      }
    ]
  },
  {
    name: 'Tailwind',
    category: 'libraries',
    rules: [
      {
        type: 'html',
        pattern: /cdn\.tailwindcss\.com|tailwind/i,
        confidence: 'medium'
      }
    ]
  }
];

/**
 * Passively fingerprints technologies and extracted versions from HTML, response headers, and URL.
 * @param {string} html - HTML body content
 * @param {Object} headers - HTTP response headers
 * @param {string} [url] - Target page URL
 * @returns {Array<Object>} List of detected technologies with version and evidence
 */
function fingerprint(html = '', headers = {}, url = '') {
  const normHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    normHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join('; ') : String(v);
  }

  let $ = null;
  const scriptSources = [];
  const metaTags = [];

  if (typeof html === 'string' && html.length > 0) {
    try {
      $ = cheerio.load(html);
      $('script[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) scriptSources.push(src);
      });
      $('meta').each((_, el) => {
        const name = $(el).attr('name') || $(el).attr('http-equiv') || $(el).attr('property');
        const content = $(el).attr('content');
        if (name && content) {
          metaTags.push({ name: name.toLowerCase(), content });
        }
      });
    } catch (_) {}
  }

  const resultsMap = new Map();

  for (const item of TECH_CATALOG) {
    for (const rule of item.rules) {
      let matched = false;
      let matchedVersion = null;
      let evidence = '';

      if (rule.type === 'header') {
        const headerVal = normHeaders[rule.name.toLowerCase()];
        if (headerVal) {
          const match = headerVal.match(rule.pattern);
          if (match) {
            matched = true;
            evidence = `Header ${rule.name}: ${headerVal}`;
            if (rule.versionGroup && match[rule.versionGroup]) {
              matchedVersion = match[rule.versionGroup];
            }
          }
        }
      } else if (rule.type === 'meta') {
        for (const meta of metaTags) {
          if (meta.name === rule.name.toLowerCase()) {
            const match = meta.content.match(rule.pattern);
            if (match) {
              matched = true;
              evidence = `Meta tag <meta name="${rule.name}" content="${meta.content}">`;
              if (rule.versionGroup && match[rule.versionGroup]) {
                matchedVersion = match[rule.versionGroup];
              }
              break;
            }
          }
        }
      } else if (rule.type === 'scriptSrc') {
        for (const src of scriptSources) {
          const match = src.match(rule.pattern);
          if (match) {
            matched = true;
            evidence = `Script src: ${src}`;
            if (rule.versionGroup && match[rule.versionGroup]) {
              matchedVersion = match[rule.versionGroup];
            }
            break;
          }
        }
      } else if (rule.type === 'html' && typeof html === 'string') {
        const match = html.match(rule.pattern);
        if (match) {
          matched = true;
          evidence = `HTML content matched pattern: ${rule.pattern}`;
          if (rule.versionGroup && match[rule.versionGroup]) {
            matchedVersion = match[rule.versionGroup];
          }
        }
      }

      if (matched) {
        const existing = resultsMap.get(item.name);
        const confidenceLevels = { low: 1, medium: 2, high: 3 };
        const newConf = rule.confidence || 'medium';

        if (!existing) {
          resultsMap.set(item.name, {
            name: item.name,
            packageName: item.packageName || item.name.toLowerCase(),
            ecosystem: item.ecosystem || null,
            category: item.category,
            version: matchedVersion || null,
            confidence: newConf,
            evidence
          });
        } else {
          // If we found a version or higher confidence, update existing
          if (!existing.version && matchedVersion) {
            existing.version = matchedVersion;
            existing.evidence = evidence;
          }
          if (confidenceLevels[newConf] > confidenceLevels[existing.confidence]) {
            existing.confidence = newConf;
            if (!existing.version && evidence) {
              existing.evidence = evidence;
            }
          }
        }
      }
    }
  }

  return Array.from(resultsMap.values());
}

/**
 * Backward-compatible helper returning categorized arrays of detected technologies.
 * Matches legacy detectTechnologies signature from aiEngine.js.
 */
function detectTechnologies(html = '', headers = {}) {
  const list = fingerprint(html, headers);
  const result = {
    cms: [],
    framework: [],
    server: [],
    analytics: [],
    libraries: []
  };

  for (const item of list) {
    if (item.category && result[item.category]) {
      result[item.category].push(item.name);
    }
  }

  // Preserve any direct regex fallback checks for legacy compatibility
  const normHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    normHeaders[k.toLowerCase()] = String(v);
  }
  const s = normHeaders['server'] ? normHeaders['server'].toLowerCase() : '';
  if (s.includes('nginx') && !result.server.includes('nginx')) result.server.push('nginx');
  if (s.includes('apache') && !result.server.includes('Apache')) result.server.push('Apache');
  if (s.includes('cloudflare') && !result.server.includes('Cloudflare')) result.server.push('Cloudflare');

  return result;
}

module.exports = {
  fingerprint,
  detectTechnologies,
  TECH_CATALOG
};

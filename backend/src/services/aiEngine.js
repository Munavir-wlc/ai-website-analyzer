const cheerio = require('cheerio');

async function generateRecommendations(report) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const { default: axios } = await import('axios');
    const issues = [
      ...(report.issues?.seo || []).map(i => `[SEO] ${i.message}`),
      ...(report.issues?.security || []).map(i => `[Security] ${i.message}`)
    ];
    if (issues.length === 0) return null;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer. Give brief, actionable recommendations to fix the issues. Respond in 2-4 short bullet points.'
          },
          {
            role: 'user',
            content: `Website audit issues:\n${issues.join('\n')}\n\nSummarize key fixes in bullet points.`
          }
        ],
        max_tokens: 200
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  } catch (_) {
    return null;
  }
}

/**
 * AI-driven Security Vulnerability Analyzer (VAPT)
 * Extracts lightweight structural metadata from HTML and headers to check for vulnerabilities via GPT-4o-mini
 */
async function analyzeSecurityWithAI(url, headers, html) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[aiEngine] No OPENAI_API_KEY found, skipping AI vulnerability checks.');
    return [];
  }

  try {
    const { default: axios } = await import('axios');
    const $ = cheerio.load(html || '');

    // 1. Extract forms structure and actions
    const forms = [];
    $('form').each((_, el) => {
      const form = $(el);
      const inputs = [];
      form.find('input, textarea, select').each((_, inp) => {
        inputs.push({
          tag: inp.name,
          type: $(inp).attr('type') || 'text',
          name: $(inp).attr('name') || '',
        });
      });
      forms.push({
        action: form.attr('action') || '',
        method: form.attr('method') || 'get',
        inputs: inputs.slice(0, 10)
      });
    });

    // 2. Extract script sources to identify outdated/known vulnerable CDN resources
    const scripts = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) scripts.push(src);
    });

    // 3. Extract target="_blank" links without rel="noopener" (tabnabbing)
    const targetBlankLinks = [];
    $('a[target="_blank"]').each((_, el) => {
      const link = $(el);
      targetBlankLinks.push({
        href: link.attr('href') || '',
        rel: link.attr('rel') || '',
        text: link.text().trim().substring(0, 30)
      });
    });

    // 4. Extract inline scripts that might be prone to XSS or contain configurations
    const inlineScripts = [];
    $('script:not([src])').each((_, el) => {
      const content = $(el).html() || '';
      if (content.trim()) {
        inlineScripts.push(content.trim().substring(0, 200));
      }
    });

    // 5. Extract comments that look like dev disclosures
    const comments = [];
    $('*').contents().each((_, el) => {
      if (el.type === 'comment') {
        const comment = el.data?.trim() || '';
        if (comment && comment.length > 5 && /password|config|debug|api|port|version|admin|db|dev/i.test(comment)) {
          comments.push(comment.substring(0, 150));
        }
      }
    });

    // 6. Sanitize headers to exclude highly sensitive transport keys like Cookie
    const headerSummary = {};
    if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (!/cookie|auth|token|jwt|session/i.test(key)) {
          headerSummary[key] = value;
        }
      }
    }

    const payload = {
      url,
      headers: headerSummary,
      htmlSummary: {
        forms: forms.slice(0, 10),
        scripts: scripts.slice(0, 15),
        targetBlankLinks: targetBlankLinks.slice(0, 10),
        inlineScripts: inlineScripts.slice(0, 5),
        developerComments: comments.slice(0, 5)
      }
    };

    const prompt = `You are an expert web security audit system (VAPT specialist).
Analyze the following JSON metadata representing a webpage's HTTP headers and structure.
Identify potential security vulnerabilities, configuration weaknesses, or missing security best practices.

URL: ${url}
Metadata:
${JSON.stringify(payload, null, 2)}

Identify issues from categories like:
- Forms transmitting sensitive data (passwords, emails, credits) over unencrypted HTTP, or lacking CSRF tokens.
- Outdated or known-vulnerable JS libraries or CDN references in scripts.
- Links opening in a new tab (target="_blank") without rel="noopener" or rel="noreferrer" (tabnabbing).
- Missing or weak security headers (specifically recommend CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- Technology version exposure or sensitive comments (leaking paths, config details).
- Inline JS scripts that could be prone to Reflected/Stored XSS.

Return a JSON object with a key "issues" containing a list of security issues. Do not wrap with markdown code block markers.
Format:
{
  "issues": [
    {
      "type": "short-code-name-like-csrf-missing",
      "severity": "high" | "medium" | "low",
      "message": "Clear explanation of the security issue",
      "fix": "Actionable instructions on how to fix this"
    }
  ]
}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a strict security analyzer. You only respond with a valid JSON object matching the requested schema. No conversational text or markdown code block markers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 18000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) return [];

    const result = JSON.parse(text);
    return Array.isArray(result.issues) ? result.issues : [];
  } catch (err) {
    console.error('[aiEngine] Security vulnerability scan failed:', err.message);
    return [];
  }
}

module.exports = { generateRecommendations, analyzeSecurityWithAI };

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dns = require('dns').promises;
const axios = require('axios');
const Domain = require('../models/Domain');
const { protect } = require('../middleware/auth');
const { isSafeUrl } = require('../utils/ssrfGuard');

/**
 * Normalizes a user-supplied hostname by stripping protocols, ports, and trailing paths.
 * @param {string} input 
 * @returns {string} Clean normalized hostname
 */
function normalizeHostname(input) {
  if (!input || typeof input !== 'string') return '';
  let host = input.trim().toLowerCase();
  // Strip protocol if present
  if (/^https?:\/\//i.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch (_) {
      host = host.replace(/^https?:\/\//i, '');
    }
  }
  // Strip paths, queries, fragments, ports
  host = host.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  return host.trim();
}

// All domain management endpoints require authentication
router.use(protect);

// GET /api/domains - List current user's domains
router.get('/', async (req, res) => {
  try {
    const domains = await Domain.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ domains });
  } catch (err) {
    console.error('[domainRoutes] Error listing domains:', err);
    res.status(500).json({ error: 'Failed to retrieve domains.' });
  }
});

// GET /api/domains/check/:hostname - Check verification status for a specific hostname
router.get('/check/:hostname', async (req, res) => {
  try {
    const hostname = normalizeHostname(req.params.hostname);
    if (!hostname) {
      return res.status(400).json({ error: 'Invalid hostname' });
    }
    const domain = await Domain.findOne({ userId: req.user._id, hostname });
    res.json({
      hostname,
      exists: !!domain,
      verified: !!(domain && domain.verified),
      domain: domain || null
    });
  } catch (err) {
    console.error('[domainRoutes] Error checking domain status:', err);
    res.status(500).json({ error: 'Failed to check domain status.' });
  }
});

// POST /api/domains - Add or register a domain for ownership verification
router.post('/', async (req, res) => {
  try {
    const { hostname: rawHostname } = req.body;
    const hostname = normalizeHostname(rawHostname);

    if (!hostname || hostname.length < 3 || !hostname.includes('.')) {
      return res.status(400).json({ error: 'Please provide a valid hostname (e.g. example.com).' });
    }

    // Check if user already registered this domain
    let domain = await Domain.findOne({ userId: req.user._id, hostname });

    if (!domain) {
      const verificationToken = crypto.randomBytes(16).toString('hex');
      domain = new Domain({
        userId: req.user._id,
        hostname,
        verificationToken,
        verified: false
      });
      await domain.save();
    }

    const token = domain.verificationToken;
    const dnsTxtRecord = `_scanverify.${hostname} TXT "scanverify=${token}"`;
    const fileUpload = {
      path: `/.well-known/scanverify-${token}.txt`,
      url: `https://${hostname}/.well-known/scanverify-${token}.txt`,
      content: token
    };

    res.status(201).json({
      domain,
      dnsTxtRecord,
      fileUpload
    });
  } catch (err) {
    console.error('[domainRoutes] Error creating domain:', err);
    res.status(500).json({ error: 'Failed to add domain for verification.' });
  }
});

// POST /api/domains/:id/verify - Verify domain ownership via DNS TXT or /.well-known HTTP file
router.post('/:id/verify', async (req, res) => {
  try {
    const domain = await Domain.findOne({ _id: req.params.id, userId: req.user._id });
    if (!domain) {
      return res.status(404).json({ error: 'Domain record not found.' });
    }

    if (domain.verified) {
      return res.json({
        verified: true,
        message: 'Domain is already verified.',
        domain
      });
    }

    const { hostname, verificationToken } = domain;
    let verified = false;
    let verificationMethod = null;

    // 1. Check DNS TXT Record on _scanverify.<hostname>
    try {
      const dnsTarget = `_scanverify.${hostname}`;
      const txtRecords = await dns.resolveTxt(dnsTarget);
      
      // dns.resolveTxt returns array of string arrays, e.g. [['scanverify=abc1234...']]
      for (const recordSet of txtRecords) {
        const fullTxt = recordSet.join('');
        if (
          fullTxt === verificationToken ||
          fullTxt === `scanverify=${verificationToken}` ||
          fullTxt.includes(`scanverify=${verificationToken}`)
        ) {
          verified = true;
          verificationMethod = 'dns-txt';
          break;
        }
      }
    } catch (dnsErr) {
      // DNS record might not exist yet; continue to file verification
    }

    // 2. If DNS check did not succeed, check HTTP File Upload at /.well-known/scanverify-<token>.txt
    if (!verified) {
      try {
        const isSafe = await isSafeUrl(hostname);
        if (isSafe) {
          const fileUrl = `https://${hostname}/.well-known/scanverify-${verificationToken}.txt`;
          const response = await axios.get(fileUrl, {
            timeout: 5000,
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 400,
            transformResponse: [(data) => data] // Keep raw string
          });

          if (typeof response.data === 'string' && response.data.trim() === verificationToken) {
            verified = true;
            verificationMethod = 'file-upload';
          }
        }
      } catch (httpErr) {
        // File may not be uploaded yet
      }
    }

    if (verified) {
      domain.verified = true;
      domain.verifiedAt = new Date();
      domain.verificationMethod = verificationMethod;
      await domain.save();

      return res.json({
        verified: true,
        message: `Domain verified successfully via ${verificationMethod}.`,
        domain
      });
    }

    return res.json({
      verified: false,
      message: 'Verification not found yet'
    });
  } catch (err) {
    console.error('[domainRoutes] Error during domain verification:', err);
    res.status(500).json({ error: 'Internal server error verifying domain.' });
  }
});

// DELETE /api/domains/:id - Remove a domain
router.delete('/:id', async (req, res) => {
  try {
    const domain = await Domain.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found or not authorized.' });
    }
    res.json({ success: true, message: 'Domain removed successfully.' });
  } catch (err) {
    console.error('[domainRoutes] Error deleting domain:', err);
    res.status(500).json({ error: 'Failed to delete domain.' });
  }
});

module.exports = router;

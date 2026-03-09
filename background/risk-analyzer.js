import { BASE_SCORE, DANGEROUS_PERMISSIONS } from './constants.js';
import { loadTrackerDB, isTrackerDomain } from '../libs/tracker-db.js';
import { gradeFromScore } from '../libs/utils.js';

const DANGEROUS_COMBOS = [
  {
    permissions: ['cookies', 'webRequest'],
    penalty: 3,
    severity: 'critical',
    title: 'Can intercept and steal login sessions',
    description: 'This combination allows reading cookies and modifying network requests, enabling session hijacking.'
  },
  {
    permissions: ['tabs', 'history'],
    penalty: 2,
    severity: 'high',
    title: 'Can track all browsing activity',
    description: 'Extension can see every website you visit and build a complete browsing profile.'
  },
  {
    permissions: ['clipboardRead', 'storage'],
    penalty: 2,
    severity: 'high',
    title: 'Can steal clipboard data',
    description: 'Could capture passwords, credit cards, or sensitive info you copy.'
  },
  {
    permissions: ['proxy', 'webRequest'],
    penalty: 3,
    severity: 'critical',
    title: 'Can redirect and monitor all traffic',
    description: 'Complete control over your internet connection - extremely dangerous.'
  },
  {
    permissions: ['debugger', 'tabs'],
    penalty: 4,
    severity: 'critical',
    title: 'Can inspect and modify any webpage',
    description: 'Developer-level access to inject code into banking sites, social media, etc.'
  },
  {
    permissions: ['desktopCapture', 'storage'],
    penalty: 3,
    severity: 'critical',
    title: 'Can record your screen',
    description: 'Could capture everything you do on your computer, including passwords typed on screen.'
  }
];

function analyzePermissionCombos(permissions, risks, score) {
  // Normalize permissions to reduce easy bypassing (e.g., webRequestBlocking equivalent)
  const normalized = new Set(permissions || []);
  if (normalized.has('webRequestBlocking')) normalized.add('webRequest');

  DANGEROUS_COMBOS.forEach(combo => {
    const hasAll = combo.permissions.every(p => normalized.has(p));
    if (hasAll) {
      score -= combo.penalty;
      risks.push({
        severity: combo.severity,
        title: combo.title,
        description: combo.description,
        type: 'permission_combo'
      });
    }
  });
  return score;
}

function analyzeHostPermissions(hostPermissions, risks, score) {
  if (!hostPermissions || hostPermissions.length === 0) return score;

  // Check for universal access
  const hasAllUrls = hostPermissions.some(p =>
    p === '<all_urls>' ||
    p === '*://*/*' ||
    p === 'http://*/*' ||
    p === 'https://*/*'
  );

  if (hasAllUrls) {
    score -= 3;
    risks.push({
      severity: 'critical',
      title: 'Access to ALL websites',
      description: 'Can read and modify every webpage you visit, including banking sites and private accounts.',
      type: 'host_permission'
    });
  }

  // Check for known sensitive domains
  const SENSITIVE_DOMAINS = [
    'accounts.google.com',
    'login.microsoftonline.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'github.com',
    'paypal.com',
    'stripe.com'
  ];

  const accessesSensitiveDomains = hostPermissions.some(pattern =>
    SENSITIVE_DOMAINS.some(domain => pattern.includes(domain))
  );

  if (accessesSensitiveDomains) {
    score -= 2;
    risks.push({
      severity: 'high',
      title: 'Access to sensitive login sites',
      description: 'Can read data from banking, email, or social media login pages.',
      type: 'host_permission'
    });
  }

  // Check for excessive domains (more than 10 = suspicious)
  if (hostPermissions.length > 10) {
    score -= 1;
    risks.push({
      severity: 'medium',
      title: `Requests access to ${hostPermissions.length} websites`,
      description: 'Overly broad permissions may indicate data harvesting.',
      type: 'host_permission'
    });
  }

  return score;
}

function analyzeAge(daysSinceInstall, risks, score) {
  if (daysSinceInstall == null) return score;

  // Very new extensions (< 7 days) = higher risk
  if (daysSinceInstall < 7) {
    score -= 1;
    risks.push({
      severity: 'medium',
      title: 'Recently installed',
      description: `Installed ${daysSinceInstall} day(s) ago. New extensions should be monitored closely.`,
      type: 'temporal'
    });
  }

  return score;
}

async function analyzeTrackerContacts(hostPermissions, risks, score) {
  if (!hostPermissions || hostPermissions.length === 0) return score;

  await loadTrackerDB(); // Load on first use (cached inside tracker-db)

  const trackerMatches = [];

  hostPermissions.forEach(pattern => {
    const domain = pattern
      .replace(/^\*:\/\//, '')
      .replace(/\/\*$/, '')
      .replace(/\*\./g, '');

    if (isTrackerDomain(domain)) {
      trackerMatches.push(domain);
    }
  });

  if (trackerMatches.length > 0) {
    score -= 2 * trackerMatches.length;
    risks.push({
      severity: 'critical',
      title: `Contacts ${trackerMatches.length} known tracker(s)`,
      description: `May send your data to: ${trackerMatches.join(', ')}`,
      type: 'tracker'
    });
  }

  return score;
}

function analyzeCSP(extension, risks, score) {
  const manifest = extension.manifest;
  
  if (!manifest) return score;
  
  // MV3 uses different CSP structure than MV2
  let csp = null;
  
  // MV3: content_security_policy is an object with extension_pages
  if (manifest.content_security_policy && typeof manifest.content_security_policy === 'object') {
    csp = manifest.content_security_policy.extension_pages || manifest.content_security_policy.sandbox;
  }
  // MV2: content_security_policy is a string
  else if (typeof manifest.content_security_policy === 'string') {
    csp = manifest.content_security_policy;
  }
  
  if (!csp) return score;
  
  const cspLower = csp.toLowerCase();
  
  // Check for unsafe-inline (allows inline scripts - XSS risk)
  if (cspLower.includes('unsafe-inline')) {
    score -= 2;
    risks.push({
      severity: 'high',
      title: 'Unsafe Content Security Policy: unsafe-inline',
      description: 'Allows inline scripts which can enable XSS attacks and arbitrary code execution.',
      type: 'csp'
    });
  }
  
  // Check for unsafe-eval (allows eval() - code injection risk)
  if (cspLower.includes('unsafe-eval')) {
    score -= 2;
    risks.push({
      severity: 'high',
      title: 'Unsafe Content Security Policy: unsafe-eval',
      description: 'Allows dynamic code evaluation (eval), which can execute arbitrary code.',
      type: 'csp'
    });
  }
  
  // Check for overly permissive script-src with wildcards
  const scriptSrcMatch = cspLower.match(/script-src[^;]*/i);
  if (scriptSrcMatch) {
    const scriptSrc = scriptSrcMatch[0];
    
    // Check for wildcard sources like 'script-src *', http://* or https://*
    if (
      scriptSrc.includes("'self' *") ||
      scriptSrc.includes("* 'self'") ||
      scriptSrc.includes('*') ||
      scriptSrc.match(/\bhttp:\/\/\*/) ||
      scriptSrc.match(/\bhttps:\/\/\*/)
    ) {
      score -= 1;
      risks.push({
        severity: 'medium',
        title: 'Permissive script sources in CSP',
        description: 'Allows loading scripts from any domain, which could load malicious code.',
        type: 'csp'
      });
    }

    // Flag external script sources (non-self) even without wildcards
    const allowsExternal = /script-src[^;]*https?:\/\//.test(scriptSrc) && !/script-src[^;]*https?:\/\/localhost/.test(scriptSrc);
    if (allowsExternal) {
      score -= 1;
      risks.push({
        severity: 'medium',
        title: 'Loads scripts from external domains',
        description: 'CSP allows scripts from external domains, increasing supply-chain risk.',
        type: 'csp'
      });
    }
  }
  
  return score;
}

function analyzeUpdateURL(extension, risks, score) {
  // manifest may be missing; default to empty object
  const manifest = extension.manifest || {};
  
  // chrome.management exposes updateUrl (camelCase); manifest uses update_url
  const updateURL = manifest.update_url || extension.updateUrl || extension.update_url;
  
  // No update URL typically means Chrome Web Store auto-update; skip
  if (!updateURL) return score;
  
  const updateURLLower = updateURL.toLowerCase();
  
  // Chrome Web Store official update URLs
  const isOfficialStore = updateURLLower.includes('clients2.google.com') ||
                          updateURLLower.includes('clients2.googleusercontent.com') ||
                          updateURLLower.includes('update.googleapis.com');
  
  if (!isOfficialStore) {
    score -= 2;
    risks.push({
      severity: 'high',
      title: 'Updates from non-official source',
      description: `Extension updates from: ${updateURL.substring(0, 60)}${updateURL.length > 60 ? '...' : ''}`,
      type: 'update'
    });
  }
  
  // Check for HTTP (unencrypted) update URL - CRITICAL security risk
  if (updateURL.startsWith('http://')) {
    score -= 3;
    risks.push({
      severity: 'critical',
      title: 'Insecure update mechanism (HTTP)',
      description: 'Updates over unencrypted HTTP - vulnerable to man-in-the-middle attacks that could inject malware.',
      type: 'update'
    });
  }
  
  // Check for suspicious domains in update URL
  const suspiciousDomains = [
    'temp-mail',
    'file-sharing',
    'free-host',
    'pastebin',
    'githubusercontent.com/raw', // Raw GitHub files (not releases)
  ];
  
  const hasSuspiciousDomain = suspiciousDomains.some(domain => 
    updateURLLower.includes(domain)
  );
  
  if (hasSuspiciousDomain) {
    score -= 1;
    risks.push({
      severity: 'medium',
      title: 'Updates from suspicious hosting',
      description: 'Update URL points to temporary or unconventional hosting service.',
      type: 'update'
    });
  }
  
  return score;
}

export async function analyzeRisk(extension) {
  let score = BASE_SCORE;
  const risks = [];

  const permissions = extension.permissions || [];
  const hostPermissions = extension.hostPermissions || [];
  const daysSinceInstall = extension.daysSinceInstall ?? null;

  permissions.forEach(p => {
    if (DANGEROUS_PERMISSIONS.includes(p)) {
      score -= 2;
      risks.push({
        title: `Sensitive permission: ${p}`,
        severity: 'high'
      });
    }
  });

  // Temporal analysis (age)
  score = analyzeAge(daysSinceInstall, risks, score);

  // Analyze risky permission combinations
  score = analyzePermissionCombos(permissions, risks, score);

  // Analyze host permissions breadth and sensitivity
  score = analyzeHostPermissions(hostPermissions, risks, score);

  // Tracker domain contacts based on host permissions
  score = await analyzeTrackerContacts(hostPermissions, risks, score);

  // Content Security Policy analysis
  score = analyzeCSP(extension, risks, score);

  // Update URL analysis
  score = analyzeUpdateURL(extension, risks, score);

  score = Math.max(0, score);

  return { score, grade: gradeFromScore(score), risks };
}

import { BASE_SCORE, DANGEROUS_PERMISSIONS } from './constants.js';
import { loadTrackerDB, isTrackerDomain } from '../libs/tracker-db.js';

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

function gradeFromScore(score) {
  if (score >= 9) return 'A+';
  if (score >= 7) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  return 'F';
}

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

  score = Math.max(0, score);

  return { score, grade: gradeFromScore(score), risks };
}

let trackerDomains = [];

export async function loadTrackerDB() {
  if (trackerDomains.length > 0) return trackerDomains;

  try {
    const url = chrome.runtime.getURL('data/tracker-domains.json');
    const res = await fetch(url);
    const json = await res.json();
    trackerDomains = json.domains || [];
  } catch (err) {
    console.warn('Tracker DB load failed, continuing empty');
    trackerDomains = [];
  }

  return trackerDomains;
}

export function isTrackerDomain(domain) {
  if (!domain) return false;

  return trackerDomains.some(tracker =>
    domain.includes(tracker) || tracker.includes(domain)
  );
}

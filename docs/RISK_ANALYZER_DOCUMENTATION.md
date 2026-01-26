# Risk Analyzer Documentation

## 1. Overview

The Risk Analyzer is the core engine of SafeExtensions that evaluates the privacy and security risks of Chrome extensions. It analyzes extension manifests, permissions, and behaviors to assign a **privacy score (0-10)** and identify specific security concerns.

**Base Score:** 10/10 (Safe)  
**Minimum Score:** 0/10 (Critical Risk)

---

## 2. Detection Features

| Feature | What It Detects | Risk Level | Penalty |
|---------|-----------------|-----------|---------|
| **Permission Combinations** | Dangerous pairs of permissions (e.g., cookies + webRequest) | Critical | -2 to -4 |
| **Host Permissions** | Overly broad website access patterns (<all_urls>, sensitive domains) | Critical/High | -1 to -3 |
| **Tracker Contacts** | Known tracking domains in host permissions | Critical | -2 per tracker |
| **Content Security Policy (CSP)** | unsafe-inline, unsafe-eval, permissive script sources | High/Medium | -1 to -2 |
| **Update URLs** | Non-official or insecure update mechanisms | Critical/High | -2 to -3 |
| **Sensitive Permissions** | Individual dangerous permissions (debugger, desktopCapture, etc.) | High | -2 per permission |
| **Age Analysis** | Recently installed extensions (<7 days) | Medium | -1 |

---

## 3. Scoring Methodology

### Grade Mapping

| Score Range | Grade | Status |
|------------|-------|--------|
| 9-10 | A+ | Excellent - Very safe |
| 7-8 | A | Good - Generally safe |
| 5-6 | B | Caution - Some risks present |
| 3-4 | C | Warning - Multiple risks |
| 0-2 | F | Critical - Severe risks |

### How Scoring Works

1. **Start at 10 points** (safe baseline)
2. **Analyze 7 risk vectors** (permissions, hosts, trackers, CSP, updates, age)
3. **Deduct points** for each risk found
4. **Cap minimum at 0** (cannot go below)
5. **Assign grade** based on final score

**Example:**
```
Base Score: 10
- Cookies + webRequest combo: -3
- Access to <all_urls>: -3
- Contact Google Analytics (tracker): -2
Final Score: 2/10 (Grade F - Critical Risk)
```

---

## 4. Risk Categories

### Critical Risks (Immediate Attention)
- **Permission Combos:** debugger+tabs, desktopCapture+storage, proxy+webRequest, cookies+webRequest
- **Universal Access:** <all_urls>, *://*/* patterns
- **Insecure Updates:** HTTP update URLs (vulnerable to man-in-the-middle attacks)
- **Tracker Contacts:** Known analytics/tracking domains

### High Risks (Monitor Closely)
- **Sensitive Permissions:** clipboardRead, nativeMessaging, history, etc.
- **Sensitive Domain Access:** Google accounts, PayPal, banking sites
- **Unsafe CSP:** unsafe-inline or unsafe-eval directives
- **Non-Official Updates:** Custom update servers outside Chrome Web Store

### Medium Risks (Worth Noting)
- **Excessive Host Permissions:** >10 different domain patterns
- **Permissive CSP:** Wildcard script sources
- **Recent Installation:** Installed <7 days ago (unproven track record)
- **External Script Sources:** Loads scripts from third-party domains

---

## 5. Important Limitations & Disclaimers

### What We CAN Detect
✅ Static manifest analysis (permissions, CSP, update URLs)  
✅ Known tracker domains (regularly updated database)  
✅ Dangerous permission combinations  
✅ Overly broad host permissions  

### What We CANNOT Detect 
(Many of these limitations are due to Chrome’s transition from Manifest V2 to Manifest V3)
❌ **Runtime behavior** - How extension actually uses permissions  
❌ **Obfuscated malware** - Encrypted or hidden malicious code  
❌ **Supply chain attacks** - Compromised but legitimate-looking extensions  
❌ **Privacy practices** - Whether extension respects user data in practice  
❌ **User reviews accuracy** - Fake or manipulated ratings on Web Store  

### Disclaimers
- **SafeExtensions is NOT a replacement for your judgment.** Always research extensions before installing.
- **Scores are based on declared permissions only.** An extension could request minimal permissions but still be privacy-invasive.
- **False positives are possible.** Some extensions legitimately need broad permissions for their function (e.g., full-page screenshot tools).
- **No real-time monitoring.** We analyze the manifest at scan time; behavior can change if extension is updated.
- **User caution required.** Low-risk score ≠ Complete safety guarantee.

---

## 6. Recommendations for Users

### Red Flags to Manually Check
🚩 Unknown developer with high-access extension  
🚩 "Free" extension that lacks a clear business model  
🚩 Extremely high ratings overnight (potential fake reviews)  
🚩 Vague description ("utility" or "enhancement" with no specifics)  
🚩 Requests permissions unrelated to stated function  

### Best Practices
✅ **Principle of Least Privilege:** Disable extensions you don't actively use  
✅ **Regular Audits:** Re-check extension permissions every 3-6 months  
✅ **Update Sources:** Prefer Chrome Web Store; avoid sideloaded extensions  
✅ **Read Reviews:** Check recent reviews for complaints about privacy/tracking  
✅ **Check Developer:** Visit developer's website/GitHub for legitimacy signals  

---

**Last Updated:** January 2026  
**Detection Engine Version:** 1.0  
**Tracker Database:** 20+ known domains

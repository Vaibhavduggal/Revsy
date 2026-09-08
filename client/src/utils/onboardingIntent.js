const ONBOARDING_INTENT_KEY = 'revsy_onboarding_intent';

export function markOnboardingIntent() {
  try {
    sessionStorage.setItem(ONBOARDING_INTENT_KEY, '1');
  } catch { /* ignore */ }
}

export function clearOnboardingIntent() {
  try {
    sessionStorage.removeItem(ONBOARDING_INTENT_KEY);
  } catch { /* ignore */ }
}

export function hasOnboardingIntent() {
  try {
    return sessionStorage.getItem(ONBOARDING_INTENT_KEY) === '1';
  } catch {
    return false;
  }
}

/** OAuth return URLs and explicit setup steps count as intentional onboarding entry. */
export function onboardingEntryAllowed() {
  if (hasOnboardingIntent()) return true;
  const p = new URLSearchParams(window.location.search);
  return ['success', 'signin', 'error'].includes(p.get('google') || '');
}

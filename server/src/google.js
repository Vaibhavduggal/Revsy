import { getDb, getBusiness } from './db.js';

const STAR = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 };

export async function refreshGoogleAccessToken(business) {
  if (!business?.googleAccessToken) return null;
  const expiresAt = business.googleTokenExpiresAt ? new Date(business.googleTokenExpiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return business.googleAccessToken;

  const refreshToken = business.googleRefreshToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return business.googleAccessToken;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) return business.googleAccessToken;

  const newExpiresAt = new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString();
  const db = getDb();
  await db.from('businesses').update({
    google_access_token: d.access_token,
    google_token_expires_at: newExpiresAt,
  }).eq('id', business.id);
  business.googleAccessToken = d.access_token;
  business.googleTokenExpiresAt = newExpiresAt;
  return d.access_token;
}

async function googleGet(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.error_description || JSON.stringify(data).slice(0, 240);
    throw new Error(`Google ${res.status}: ${msg}`);
  }
  return data;
}

async function googlePut(url, accessToken, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.error_description || JSON.stringify(data).slice(0, 240);
    throw new Error(`Google ${res.status}: ${msg}`);
  }
  return data;
}

export function buildGoogleReviewResourceName(business, googleReviewId) {
  if (!googleReviewId) return null;
  const id = String(googleReviewId);
  if (id.includes('/reviews/')) return id;
  const loc = business?.googleLocationName;
  if (!loc) return null;
  return `${loc}/reviews/${id}`;
}

/** Post owner reply via GBP API (requires business.manage scope). */
export async function postGoogleReviewReply(business, googleReviewId, comment) {
  const accessToken = await refreshGoogleAccessToken(business);
  if (!accessToken) throw new Error('Google account is not connected');
  const reviewName = buildGoogleReviewResourceName(business, googleReviewId);
  if (!reviewName) throw new Error('Google location or review ID is missing');
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
  return googlePut(url, accessToken, { comment: String(comment || '').slice(0, 4000) });
}

export function googleReviewReportUrl(business) {
  const pid = business?.placeId;
  if (pid && !String(pid).includes('accounts/') && !String(pid).includes('/locations/')) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(pid)}`;
  }
  const link = business?.googleReviewLink || '';
  try {
    const u = new URL(link);
    const placeid = u.searchParams.get('placeid');
    if (placeid) return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeid)}`;
  } catch { /* ignore */ }
  return 'https://business.google.com/reviews';
}

export async function listGoogleLocations(business) {
  const accessToken = await refreshGoogleAccessToken(business);
  if (!accessToken) throw new Error('Google account is not connected');

  const accounts = await googleGet('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', accessToken);
  const accountList = accounts.accounts || [];
  const locations = [];

  for (const account of accountList) {
    const accountName = account.name;
    const locUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,metadata,phoneNumbers`;
    let pageToken = '';
    do {
      const url = pageToken ? `${locUrl}&pageToken=${encodeURIComponent(pageToken)}` : locUrl;
      const page = await googleGet(url, accessToken);
      for (const loc of page.locations || []) {
        const placeId = loc.metadata?.placeId || '';
        const addressParts = loc.storefrontAddress
          ? [loc.storefrontAddress.addressLines, loc.storefrontAddress.locality, loc.storefrontAddress.administrativeArea, loc.storefrontAddress.postalCode].flat().filter(Boolean)
          : [];
        locations.push({
          accountName,
          accountDisplayName: account.accountName || accountName,
          locationName: loc.name,
          title: loc.title || 'Untitled location',
          address: addressParts.join(', '),
          placeId,
          reviewLink: placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : '',
        });
      }
      pageToken = page.nextPageToken || '';
    } while (pageToken);
  }

  return locations;
}

function mapStar(starRating, numeric) {
  if (Number.isFinite(Number(numeric))) return Number(numeric);
  return STAR[starRating] || 0;
}

async function fetchGbpReviews(accessToken, locationName) {
  const out = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews?${qs}`;
    const page = await googleGet(url, accessToken);
    for (const rev of page.reviews || []) {
      const created = rev.createTime || rev.updateTime;
      out.push({
        googleReviewId: rev.name || rev.reviewId,
        customerName: rev.reviewer?.displayName || 'Google user',
        rating: mapStar(rev.starRating, rev.starRatingValue),
        text: rev.comment || '',
        createdAt: created ? new Date(created).toISOString() : new Date().toISOString(),
      });
    }
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return out;
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export async function saveSelectedLocation(businessId, location) {
  const db = getDb();
  const updates = {
    google_location_name: location.locationName || null,
    google_review_link: location.reviewLink || '',
  };
  if (location.placeId) updates.place_id = location.placeId;
  else if (location.locationName) updates.place_id = location.locationName;
  await db.from('businesses').update(updates).eq('id', businessId);
}

export async function autoSelectLocationIfSingle(business) {
  const locations = await listGoogleLocations(business);
  if (locations.length === 1) {
    await saveSelectedLocation(business.id, locations[0]);
    const updated = await getBusiness(business.id);
    return { locations, selected: locations[0], business: updated };
  }
  return { locations, selected: null, business };
}

export async function syncGoogleReviewsForBusiness(business, { classifyNegative } = {}) {
  const db = getDb();
  const accessToken = await refreshGoogleAccessToken(business);
  if (!accessToken) {
    return { connected: false, message: 'Google account is not connected. Finish onboarding to connect Business Profile.' };
  }

  let locationName = business.googleLocationName;
  if (!locationName) {
    try {
      const { locations, selected } = await autoSelectLocationIfSingle(business);
      if (selected) locationName = selected.locationName;
      else if (locations.length === 0) {
        return { connected: false, message: 'No Google Business Profile locations were found on this Google account.' };
      } else {
        return { connected: false, needsLocation: true, locations, message: 'Select which location Revsy should pull reviews from.' };
      }
    } catch (e) {
      return { connected: false, message: e.message };
    }
  }

  const since = new Date(Date.now() - 365 * 86400000);
  let googleReviews;
  try {
    googleReviews = await fetchGbpReviews(accessToken, locationName);
  } catch (e) {
    return { connected: false, message: e.message };
  }

  const recent = googleReviews.filter((r) => new Date(r.createdAt) >= since);
  let added = 0;
  const newNegatives = [];

  for (const gr of recent) {
    if (!gr.googleReviewId) continue;
    const { data: existing } = await db.from('reviews').select('id').eq('google_review_id', gr.googleReviewId).limit(1);
    if (existing && existing.length) continue;

    const newRevId = newId('rev');
    const row = {
      id: newRevId,
      business_id: business.id,
      customer_id: null,
      customer_name: gr.customerName,
      rating: gr.rating,
      text: gr.text || '',
      source: 'google',
      google_review_id: gr.googleReviewId,
      request_id: null,
      sent_at: null,
      created_at: gr.createdAt,
      is_read: false,
      ai_flag: null,
      ai_issue_id: null,
    };
    await db.from('reviews').insert(row);
    added++;
    if (gr.rating > 0 && gr.rating < 4) {
      newNegatives.push({ id: newRevId, rating: gr.rating, text: gr.text || '' });
    }
  }

  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('rating', 4);
  await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', business.id);

  if (typeof classifyNegative === 'function') {
    for (const n of newNegatives) {
      try { await classifyNegative(business.id, n); } catch (e) {
        console.error('immediate AI classify failed (retry on cron):', e.message);
      }
    }
  }

  return { connected: true, added, total: recent.length, locationName };
}

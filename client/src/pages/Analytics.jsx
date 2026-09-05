import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Icon } from '../components/Icons.jsx';
import { useToast } from '../components/useToast.jsx';
import { getCopy } from '../utils/categoryCopy.js';

function LineChart({ weeks }) {
  const W = 640, H = 220, pad = 28;
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const step = (W - pad * 2) / (weeks.length - 1);
  const pts = weeks.map((w, i) => {
    const x = pad + i * step;
    const y = H - pad - (w.count / max) * (H - pad * 2);
    return { x, y, w };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1].x.toFixed(1)},${H - pad} L${pts[0].x.toFixed(1)},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={H - pad - f * (H - pad * 2)} y2={H - pad - f * (H - pad * 2)} stroke="#eee" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#lg)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="2" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.w.count}</text>
          {i % 2 === 0 && <text x={p.x} y={H - pad + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.w.label}</text>}
        </g>
      ))}
    </svg>
  );
}

function SentimentDonut({ s }) {
  const pos = s?.positives || 0;
  const neg = s?.negatives || 0;
  const total = pos + neg || 1;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const posLen = (pos / total) * circ;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={r} fill="none" stroke="var(--warn)" strokeWidth="20" />
      <circle
        cx="75" cy="75" r={r} fill="none" stroke="var(--ok)" strokeWidth="20"
        strokeDasharray={`${posLen} ${circ - posLen}`} strokeDashoffset="0"
        transform="rotate(-90 75 75)"
      />
      <text x="75" y="70" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)">{pos + neg}</text>
      <text x="75" y="90" textAnchor="middle" fontSize="12" fill="var(--muted)">reactions</text>
    </svg>
  );
}

function PositiveRateLine({ weeks }) {
  const W = 640, H = 200, pad = 28;
  const valid = weeks.filter((w) => w.rate !== null);
  const data = valid.length ? valid : weeks;
  const step = (W - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((w, i) => {
    const x = pad + i * step;
    const y = H - pad - (w.rate / 100) * (H - pad * 2);
    return { x, y, w };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {[0, 25, 50, 75, 100].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W - pad} y1={H - pad - (f / 100) * (H - pad * 2)} y2={H - pad - (f / 100) * (H - pad * 2)} stroke="#eee" strokeWidth="1" />
          <text x={pad - 8} y={H - pad - (f / 100) * (H - pad * 2) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{f}%</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="var(--ok)" strokeWidth="2" />
          {i % 2 === 0 && <text x={p.x} y={H - pad + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.w.label}</text>}
        </g>
      ))}
    </svg>
  );
}
function DowChart({ dow, labels }) {
  const max = Math.max(1, ...dow);
  return (
    <div className="chart" style={{ height: 180 }}>
      {dow.map((v, i) => (
        <div className="bar-col" key={i}>
          <span className="val">{v}</span>
          <div className="bar" style={{ height: `${(v / max) * 100}%`, background: 'linear-gradient(180deg, var(--accent-2), var(--accent))' }} title={`${v} reviews`} />
          <span className="lbl">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Funnel({ funnel }) {
  const stages = [
    { label: 'Requests sent', value: funnel.sent, pct: 100 },
    { label: 'Opened', value: funnel.opened, pct: funnel.sentToOpenedPct },
    { label: 'Reviewed', value: funnel.reviewed, pct: funnel.sentToReviewedPct },
  ];
  return (
    <div className="funnel">
      {stages.map((s, i) => (
        <div key={s.label} className="funnel-stage">
          <div className="flex between" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</span>
            <span style={{ fontWeight: 800 }}>{s.value.toLocaleString()}</span>
          </div>
          <div className="funnel-bar" style={{ width: `${s.pct}%` }}>{s.pct}%</div>
          {i < stages.length - 1 && (
            <div className="funnel-drop">▼ {100 - s.pct < 0 ? 0 : (100 - s.pct).toFixed(1)}% drop-off</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { business } = useAuth();
  const copy = getCopy(business?.category);
  const { show, node } = useToast();
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.analytics();
      setA(r);
    } catch (e) { show(e.message); } finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  if (loading || !a) return <div className="page"><div className="empty">Loading analytics…</div></div>;

  const momUp = a.momPct >= 0;
  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Review Analytics</h1>
          <div className="sub">All metrics are computed from real seeded review data (no hardcoded numbers).</div>
        </div>
        <button className="btn" onClick={() => setLogOpen(true)}><Icon.plus width={16} height={16} /> Log a review</button>
      </div>

      <div className="stat-grid">
        <div className="stat accent">
          <div className="icon"><Icon.star width={20} height={20} /></div>
          <div className="label">Reviews received (all-time)</div>
          <div className="value">{a.total}</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.bolt width={20} height={20} /></div>
          <div className="label">This month ({monthName})</div>
          <div className="value">{a.reviewsThisMonth}</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.clock width={20} height={20} /></div>
          <div className="label">Avg time-to-review</div>
          <div className="value">{a.avgTimeToReview != null ? `${a.avgTimeToReview}h` : '—'}</div>
        </div>
        <div className="stat">
          <div className="icon">{momUp ? <Icon.rocket width={20} height={20} /> : <Icon.chart width={20} height={20} />}</div>
          <div className="label">Month-over-month</div>
          <div className="value" style={{ color: momUp ? 'var(--ok)' : 'var(--warn)' }}>
            {momUp ? '▲' : '▼'} {Math.abs(a.momPct)}%
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Positive vs Negative</h3>
        <div className="sub">{copy.personPluralTitle} who replied 😊 or 😞 after the message</div>
        <div className="flex" style={{ gap: 28, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <SentimentDonut s={a.sentiment} />
          <div className="flex col" style={{ gap: 10 }}>
            <div className="flex between" style={{ width: 200 }}><span><span className="dot pos" /> Positive</span><b>{a.sentiment.positives}</b></div>
            <div className="flex between" style={{ width: 200 }}><span><span className="dot neg" /> Negative</span><b>{a.sentiment.negatives}</b></div>
            <div className="flex between" style={{ width: 200 }}><span className="muted">Positive rate</span><b style={{ color: 'var(--ok)' }}>{a.sentiment.positiveRate}%</b></div>
          </div>
          <div className="catch-banner">
            <Icon.shield width={28} height={28} />
            <div>
              <b>{a.sentiment.keptOffGoogleThisMonth}</b> negative experience{a.sentiment.keptOffGoogleThisMonth === 1 ? '' : 's'} kept off Google this month.
              <div className="muted" style={{ fontSize: 12 }}>Unhappy replies stay private — we never send a Google link on that branch.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Positive rate over time</h3>
        <div className="sub">Share of 👍 reactions, last 12 weeks</div>
        <div className="spacer" />
        <PositiveRateLine weeks={a.sentiment.weeks} />
      </div>

      <div className="row two" style={{ marginTop: 16 }}>
        <div className="card" data-testid="analytics-suggestions">
          <h3>{copy.suggestionsTitle}</h3>
          <div className="sub">{copy.suggestionsSub}</div>
          <div className="spacer" />
          {(a.sentiment.recentSuggestions || []).length === 0 ? (
            <div className="empty">No suggestions yet — they appear when a happy {copy.person} replies with an idea.</div>
          ) : (
            <div className="feedback-list">
              {a.sentiment.recentSuggestions.map((f) => (
                <div className="feedback-row" key={f.id}>
                  <div className="avatar sm">{f.customerName?.[0] || '?'}</div>
                  <div className="flex col" style={{ gap: 2 }}>
                    <div><b>{f.customerName}</b> <span className="muted" style={{ fontSize: 12 }}>· {f.phone}</span></div>
                    <div className="muted" style={{ fontSize: 13 }}>{f.complaint}</div>
                  </div>
                  <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card" data-testid="analytics-complaints">
          <h3>{copy.complaintsTitle}</h3>
          <div className="sub">{copy.complaintsSub}</div>
          <div className="spacer" />
          {(a.sentiment.recentFeedback || []).length === 0 ? (
            <div className="empty">No private complaints yet.</div>
          ) : (
            <div className="feedback-list">
              {a.sentiment.recentFeedback.map((f) => (
                <div className="feedback-row" key={f.id}>
                  <div className="avatar sm">{f.customerName?.[0] || '?'}</div>
                  <div className="flex col" style={{ gap: 2 }}>
                    <div><b>{f.customerName}</b> <span className="muted" style={{ fontSize: 12 }}>· {f.phone}</span></div>
                    <div className="muted" style={{ fontSize: 13 }}>{f.complaint}</div>
                  </div>
                  <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="row two">
        <div className="card">
          <h3>Reviews per week</h3>
          <div className="sub">Last 12 weeks</div>
          <div className="spacer" />
          <LineChart weeks={a.weeks} />
        </div>
        <div className="card">
          <h3>Reviews by day of week</h3>
          <div className="sub">Which days bring the most reviews</div>
          <div className="spacer" />
          <DowChart dow={a.dow} labels={a.dowLabels} />
        </div>
      </div>

      <div className="row two" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Conversion funnel</h3>
          <div className="sub">Requests sent → opened → reviewed</div>
          <div className="spacer" />
          <Funnel funnel={a.funnel} />
        </div>
        <div className="card">
          <h3>Month-over-month</h3>
          <div className="sub">Versus last month</div>
          <div className="spacer" />
          <div className="mom-card">
            <div className="flex between" style={{ marginBottom: 10 }}>
              <span className="muted">This month</span><b>{a.reviewsThisMonth}</b>
            </div>
            <div className="flex between" style={{ marginBottom: 10 }}>
              <span className="muted">Last month</span><b>{a.reviewsLastMonth}</b>
            </div>
            <div className="divider" />
            <p style={{ fontSize: 15, lineHeight: 1.5 }}>
              You got <b>{a.reviewsThisMonth}</b> reviews this month vs <b>{a.reviewsLastMonth}</b> last month —
              <span style={{ color: momUp ? 'var(--ok)' : 'var(--warn)', fontWeight: 700 }}>
                {' '}{momUp ? 'up' : 'down'} {Math.abs(a.momPct)}%
              </span>.
            </p>
          </div>
        </div>
      </div>

      {logOpen && (
        <div className="modal-backdrop" onMouseDown={() => setLogOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="x-btn" onClick={() => setLogOpen(false)}>×</button>
            <h2>Log a review</h2>
            <div className="sub">Manually add a review (e.g. from Google before the API is connected).</div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const name = e.target.customerName.value.trim();
              const rating = Number(e.target.rating.value) || 5;
              try {
                await api.addReview({ customerName: name || null, rating });
                show('Review logged');
                setLogOpen(false);
                load();
              } catch (err) { show(err.message); }
            }}>
              <div className="field">
                <label>{copy.personTitle} name (optional)</label>
                <input className="input" name="customerName" placeholder="Leave blank for anonymous" />
              </div>
              <div className="field">
                <label>Star rating</label>
                <select className="select" name="rating" defaultValue="5">
                  <option value="5">5 ★</option>
                  <option value="4">4 ★</option>
                  <option value="3">3 ★</option>
                  <option value="2">2 ★</option>
                  <option value="1">1 ★</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setLogOpen(false)}>Cancel</button>
                <button type="submit" className="btn">Log review</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {node}
    </div>
  );
}

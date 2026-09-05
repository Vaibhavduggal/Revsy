import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Icons.jsx';
import ReviewMotif from '../components/marketing/ReviewMotif.jsx';
import RupeeCoin from '../components/marketing/RupeeCoin.jsx';
import '../styles-marketing.css';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Automated WhatsApp review requests',
    body: 'Add a customer name and phone after each visit. Revsy queues a personalized review ask on your schedule.',
    stat: '30 min',
    statLabel: 'default delay before send',
    href: '#features',
  },
  {
    icon: '◐',
    title: 'Positive & negative sentiment gating',
    body: 'Happy guests get your Google review link. Unhappy ones are invited to share feedback privately first.',
    stat: 'Private',
    statLabel: 'negative feedback path',
    href: '#features',
  },
  {
    icon: '◎',
    title: 'AI issue detection',
    body: 'Recurring problems in negative reviews are grouped into clear themes — not one-off rants.',
    stat: 'Auto',
    statLabel: 'recurring issue clustering',
    href: '#features',
  },
  {
    icon: '↻',
    title: 'Real-time Google review sync',
    body: 'Connect Google Business Profile once. New reviews appear in your dashboard as they arrive.',
    stat: '12 mo',
    statLabel: 'of review history synced',
    href: '#features',
  },
];

const INDUSTRIES = [
  {
    id: 'restaurants',
    title: 'For Restaurants',
    body: 'Turn every table into a review opportunity — without awkward asks at the door.',
    cta: 'See restaurant workflow',
  },
  {
    id: 'gyms',
    title: 'For Gyms',
    body: 'Follow up after class check-ins and memberships with a timely, personal WhatsApp nudge.',
    cta: 'See gym workflow',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="mkt">
      <header className="mkt-nav">
        <a className="mkt-brand" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <Logo /><span>Revsy</span>
        </a>
        <nav className="mkt-nav-links" aria-label="Primary">
          <a href="#restaurants">For Restaurants</a>
          <a href="#gyms">For Gyms</a>
          <button type="button" className="mkt-link-btn" onClick={() => navigate('/login')}>Sign in</button>
        </nav>
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={() => navigate('/signup')}>
          Get started
        </button>
      </header>

      <section className="mkt-hero">
        <div className="mkt-container mkt-hero-inner">
          <div className="mkt-hero-copy">
            <h1>Get more Google reviews, automatically</h1>
            <p className="mkt-lead">
              Revsy sends WhatsApp review requests after each visit, syncs your Google reviews,
              and surfaces recurring issues from negative feedback — so you fix what matters.
            </p>
            <div className="mkt-hero-actions">
              <button type="button" className="mkt-btn mkt-btn-primary mkt-btn-lg" onClick={() => navigate('/signup')}>
                Get started
              </button>
              <button type="button" className="mkt-btn mkt-btn-ghost" onClick={() => navigate('/demo')}>
                View live demo
              </button>
            </div>
          </div>
          <div className="mkt-hero-motif" aria-hidden="true">
            <RupeeCoin size={180} />
          </div>
        </div>
      </section>

      <section className="mkt-trust">
        <div className="mkt-container mkt-trust-inner">
          <p className="mkt-trust-label">Built for local businesses in Ludhiana and across India</p>
          <div className="mkt-trust-stats">
            <div><strong>WhatsApp</strong><span>review requests on your BSP</span></div>
            <div><strong>Google</strong><span>Business Profile sync</span></div>
            <div><strong>AI</strong><span>recurring issue insights</span></div>
          </div>
        </div>
      </section>

      <section className="mkt-features" id="features">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Everything you need to grow reviews — and learn from them</h2>
          <div className="mkt-feature-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="mkt-feature-card">
                <div className="mkt-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <div className="mkt-stat">
                  <span className="mkt-stat-value">{f.stat}</span>
                  <span className="mkt-stat-label">{f.statLabel}</span>
                </div>
                <a className="mkt-learn" href={f.href}>Learn more</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-industries">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Built for every kind of local business</h2>
          <div className="mkt-industry-grid">
            {INDUSTRIES.map((ind) => (
              <article key={ind.id} id={ind.id} className="mkt-industry-card">
                <ReviewMotif size={72} className="mkt-motif mkt-motif-sm" />
                <h3>{ind.title}</h3>
                <p>{ind.body}</p>
                <a className="mkt-learn" href={`#${ind.id}`}>{ind.cta}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-quote">
        <div className="mkt-container mkt-quote-grid">
          <blockquote>
            <p>
              “We finally see what guests love — and what keeps coming up in negative feedback —
              without chasing every customer for a review.”
            </p>
            <footer>
              <cite>Early Revsy pilot partner</cite>
              <span>Local restaurant, Punjab</span>
            </footer>
          </blockquote>
        </div>
      </section>

      <section className="mkt-dark">
        <div className="mkt-container mkt-dark-inner">
          <div className="mkt-dark-copy">
            <p className="mkt-eyebrow">For business owners</p>
            <h2>Set up in minutes — no technical knowledge needed</h2>
            <p>Connect your accounts once. Revsy handles the rest.</p>
            <div style={{ marginTop: 20 }}>
              <RupeeCoin size={72} />
            </div>
          </div>
          <ol className="mkt-steps">
            <li><span>1</span><div><strong>Sign up</strong><p>Create your business account in under a minute.</p></div></li>
            <li><span>2</span><div><strong>Connect Google &amp; WhatsApp</strong><p>Link Business Profile and your messaging provider.</p></div></li>
            <li><span>3</span><div><strong>Start collecting reviews</strong><p>Add customers and let Revsy queue review requests.</p></div></li>
          </ol>
          <button type="button" className="mkt-btn mkt-btn-light" onClick={() => navigate('/signup')}>
            Create your account
          </button>
        </div>
      </section>

      <section className="mkt-cta-band">
        <div className="mkt-container mkt-cta-band-inner">
          <h2>More reviews. Fewer surprises.</h2>
          <p>See how Revsy works with a live demo — or start your own account today.</p>
          <div className="mkt-hero-actions">
            <button type="button" className="mkt-btn mkt-btn-primary mkt-btn-lg" onClick={() => navigate('/demo')}>
              Book a demo
            </button>
            <button type="button" className="mkt-btn mkt-btn-outline-dark" onClick={() => navigate('/signup')}>
              Get started
            </button>
          </div>
        </div>
      </section>

      <footer className="mkt-footer">
        <div className="mkt-container mkt-footer-grid">
          <div className="mkt-footer-brand">
            <div className="mkt-brand"><Logo /><span>Revsy</span></div>
            <p>Review collection and analysis for local businesses.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#restaurants">For Restaurants</a>
            <a href="#gyms">For Gyms</a>
            <button type="button" className="mkt-footer-link" onClick={() => navigate('/demo')}>Live demo</button>
          </div>
          <div>
            <h4>Company</h4>
            <a href="mailto:hello@revsy.app">Contact</a>
            <button type="button" className="mkt-footer-link" onClick={() => navigate('/admin/login')}>Platform admin</button>
          </div>
          <div>
            <h4>Legal</h4>
            <span className="mkt-muted">Terms</span>
            <span className="mkt-muted">Privacy</span>
          </div>
        </div>
        <div className="mkt-container mkt-footer-bottom">
          <span>© {new Date().getFullYear()} Revsy</span>
        </div>
      </footer>
    </div>
  );
}

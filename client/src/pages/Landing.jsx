import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Icons.jsx';
import ReviewMotif from '../components/marketing/ReviewMotif.jsx';
import RupeeCoin from '../components/marketing/RupeeCoin.jsx';
import AnimatedHeadline from '../components/marketing/AnimatedHeadline.jsx';
import LoopBeat from '../components/marketing/LoopBeat.jsx';
import DrawGeoAccent from '../components/marketing/DrawGeoAccent.jsx';
import '../styles-marketing.css';

const LOOP_BEATS = [
  {
    id: 'ask',
    step: '1',
    title: 'Ask.',
    body: 'The moment someone walks out happy, Revsy\u2019s already messaged them.',
    substat: 'Sent within minutes, every time',
  },
  {
    id: 'sort',
    step: '2',
    title: 'Sort.',
    body: 'Happy customers go straight to Google. Unhappy ones come straight to you \u2014 quietly.',
    substat: 'Private feedback never reaches Google',
  },
  {
    id: 'learn',
    step: '3',
    title: 'Learn.',
    body: 'Every complaint, every suggestion, clustered by AI into exactly what to fix next.',
    substat: 'Patterns spotted, not just noise',
  },
];

const INDUSTRIES = [
  {
    id: 'restaurants',
    title: 'For Restaurants',
    body: 'Turn every satisfied table into a five-star review \u2014 and catch a bad night before it becomes a bad rating.',
  },
  {
    id: 'gyms',
    title: 'For Gyms',
    body: 'Every renewal is a happy member. Every happy member is a review waiting to happen.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const onScroll = () => {
      const heroBottom = hero.getBoundingClientRect().bottom;
      setNavScrolled(heroBottom <= 72);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToLoop = () => {
    document.getElementById('loop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mkt">
      <header className={`mkt-nav${navScrolled ? ' mkt-nav--scrolled' : ''}`}>
        <a className="mkt-brand" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <Logo /><span>Revsy</span>
        </a>
        <button
          type="button"
          className="mkt-nav-toggle"
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
        <nav className={`mkt-nav-links${mobileOpen ? ' mkt-nav-links--open' : ''}`} aria-label="Primary">
          <a href="#loop" onClick={() => setMobileOpen(false)}>How it works</a>
          <a href="#restaurants" onClick={() => setMobileOpen(false)}>For Restaurants</a>
          <a href="#gyms" onClick={() => setMobileOpen(false)}>For Gyms</a>
          <button type="button" className="mkt-link-btn" onClick={() => { setMobileOpen(false); navigate('/login'); }}>Sign in</button>
          <button type="button" className="mkt-btn mkt-btn-primary" onClick={() => { setMobileOpen(false); navigate('/signup'); }}>Get Started</button>
        </nav>
        <button type="button" className="mkt-btn mkt-btn-primary mkt-nav-cta" onClick={() => navigate('/signup')}>
          Get Started
        </button>
      </header>

      <section className="mkt-hero" ref={heroRef}>
        <div className="mkt-hero-mesh" aria-hidden="true" />
        <div className="mkt-container mkt-hero-inner">
          <div className="mkt-hero-copy">
            <p className="editorial-kicker"><DrawGeoAccent /> For restaurants &amp; gyms</p>
            <AnimatedHeadline text="Every review starts with a moment." />
            <p className="mkt-lead">
              Revsy catches it &mdash; automatically asking on WhatsApp, right after the moment
              happens, so nothing gets forgotten and nothing gets lost.
            </p>
            <div className="mkt-hero-actions">
              <button type="button" className="mkt-btn mkt-btn-primary mkt-btn-lg" onClick={() => navigate('/signup')}>
                Get Started
              </button>
              <button type="button" className="mkt-btn mkt-btn-ghost" onClick={scrollToLoop}>
                See how it works
              </button>
            </div>
          </div>
          <div className="mkt-hero-motif" aria-hidden="true">
            <RupeeCoin size={160} />
          </div>
        </div>
      </section>

      <section className="mkt-trust">
        <div className="mkt-container mkt-trust-inner">
          <p className="mkt-trust-quote">Quietly running behind gyms and restaurants across Punjab.</p>
        </div>
      </section>

      <section className="mkt-loop" id="loop">
        <div className="mkt-container">
          <h2 className="mkt-section-title"><DrawGeoAccent shape="circle" /> The Loop</h2>
          <p className="mkt-loop-intro">Three beats. One quiet system working in the background.</p>
          <div className="mkt-loop-track">
            {LOOP_BEATS.map((beat, i) => (
              <LoopBeat key={beat.id} index={i} {...beat} />
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-industries">
        <div className="mkt-container">
          <h2 className="mkt-section-title">Built for how you actually operate</h2>
          <div className="mkt-industry-grid">
            {INDUSTRIES.map((ind) => (
              <article key={ind.id} id={ind.id} className="mkt-industry-card mkt-hover-card">
                <ReviewMotif size={72} className="mkt-motif mkt-motif-sm" />
                <h3>{ind.title}</h3>
                <p>{ind.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-dark">
        <div className="mkt-container mkt-dark-inner">
          <DrawGeoAccent shape="circle" size={20} className="mkt-dark-accent" />
          <h2>You don&apos;t need another app to manage.</h2>
          <p className="mkt-dark-lead">
            Sign up, connect your Google listing and WhatsApp, and Revsy runs quietly in the
            background from day one.
          </p>
          <button type="button" className="mkt-btn mkt-btn-light mkt-btn-lg" onClick={() => navigate('/demo')}>
            Book a Demo
          </button>
        </div>
      </section>

      <footer className="mkt-footer">
        <div className="mkt-container mkt-footer-grid">
          <div className="mkt-footer-brand">
            <div className="mkt-brand"><Logo /><span>Revsy</span></div>
            <p className="mkt-footer-tagline">Revsy &mdash; the quiet system behind loud reputations.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#loop">How it works</a>
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
          <span>&copy; {new Date().getFullYear()} Revsy</span>
        </div>
      </footer>
    </div>
  );
}

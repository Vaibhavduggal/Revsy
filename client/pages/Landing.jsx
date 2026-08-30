import { useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../components/Icons.jsx';

const PRICE = 999;

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing">
      <header className="land-top">
        <div className="brand"><Logo /><span>ReviewBot</span></div>
        <div className="flex" style={{ gap: 10 }}>
          <button className="btn secondary sm" onClick={() => navigate('/login')}>Log in</button>
          <button className="btn sm" onClick={() => navigate('/login')}>Start Free Trial</button>
        </div>
      </header>

      <section className="hero">
        <span className="pill">For restaurants, salons, clinics & local brands</span>
        <h1>Get More Google Reviews on <span className="hl">Autopilot</span></h1>
        <p>
          ReviewBot automatically follows up with every customer on WhatsApp and turns happy
          visitors into 5-star Google reviews — no apps, no APIs, no headaches.
        </p>
        <div className="cta-row">
          <button className="btn" onClick={() => navigate('/login')}>
            <Icon.rocket width={18} height={18} /> Start Free Trial
          </button>
          <button className="btn secondary" onClick={() => navigate('/login')}>See Demo</button>
        </div>
      </section>

      <section className="features">
        <div className="feature card">
          <div className="ico"><Icon.bolt width={26} height={26} /></div>
          <h3>Automated WhatsApp follow-ups</h3>
          <p>Customers get a friendly review request on WhatsApp within hours of their visit — fully automated and on-brand.</p>
        </div>
        <div className="feature card">
          <div className="ico"><Icon.star width={26} height={26} /></div>
          <h3>More 5-star reviews</h3>
          <p>A direct link to your Google review page means customers actually complete the review, lifting your rating fast.</p>
        </div>
        <div className="feature card">
          <div className="ico"><Icon.chart width={26} height={26} /></div>
          <h3>Live dashboard & insights</h3>
          <p>Track requests sent, reviews received, and your conversion rate in real time, with weekly trends at a glance.</p>
        </div>
      </section>

      <section className="pricing">
        <h2>Simple, honest pricing</h2>
        <div className="sub">Everything you need to grow your Google rating. Cancel anytime.</div>
        <div className="price-card">
          <div className="amount">₹{PRICE}<span className="per">/month</span></div>
          <div className="sub" style={{ marginTop: 6 }}>14-day free trial · no card required</div>
          <ul>
            <li>Unlimited WhatsApp review requests</li>
            <li>Editable message templates</li>
            <li>Live dashboard + weekly charts</li>
            <li>CSV customer import</li>
            <li>Activity feed & delivery tracking</li>
          </ul>
          <button className="btn" style={{ width: '100%' }} onClick={() => navigate('/login')}>
            <Icon.rocket width={18} height={18} /> Start Free Trial
          </button>
        </div>
      </section>

      <footer className="land-foot">
        ReviewBot — a demo review-collection platform. All messages are simulated locally for demonstration.
      </footer>
    </div>
  );
}

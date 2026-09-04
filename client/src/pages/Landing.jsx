import { useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../components/Icons.jsx';

const PRICE = 999;

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing">
      <header className="land-top">
        <div className="brand"><Logo /><span>Revsy</span></div>
        <div className="flex" style={{ gap: 10 }}>
          <button className="btn ghost sm" onClick={() => navigate('/admin/login')}>Owner login</button>
          <button className="btn secondary sm" onClick={() => navigate('/login')}>Client login</button>
          <button className="btn sm" onClick={() => navigate('/signup')}>Get started</button>
        </div>
      </header>

      <section className="hero">
        <span className="pill">For restaurants that want more Google reviews — and fewer surprises</span>
        <h1>Ask for reviews on WhatsApp. <span className="hl">Fix what keeps coming up.</span></h1>
        <p>
          Revsy sends a personalized WhatsApp review request after each visit, pulls your real Google reviews,
          and uses AI to group negative feedback into the issues you should actually fix.
        </p>
        <div className="cta-row">
          <button className="btn" onClick={() => navigate('/signup')}>
            <Icon.rocket width={18} height={18} /> Create a business account
          </button>
          <button className="btn secondary" onClick={() => navigate('/demo')}>See live demo</button>
        </div>
      </section>

      <section className="features">
        <div className="feature card">
          <div className="ico"><Icon.bolt width={26} height={26} /></div>
          <h3>Automated WhatsApp asks</h3>
          <p>Add a name and phone. Revsy queues a review request immediately or after the delay you set.</p>
        </div>
        <div className="feature card">
          <div className="ico"><Icon.star width={26} height={26} /></div>
          <h3>Real Google reviews</h3>
          <p>Connect Business Profile once. Positive and negative reviews stay side by side, with unread ones highlighted.</p>
        </div>
        <div className="feature card">
          <div className="ico"><Icon.chart width={26} height={26} /></div>
          <h3>AI issues, not summaries</h3>
          <p>Recurring problems are clustered. New reviews increment a known issue or flag a genuinely new one.</p>
        </div>
      </section>

      <section className="pricing">
        <h2>Simple pricing</h2>
        <div className="sub">Built for local restaurants. Cancel anytime.</div>
        <div className="price-card">
          <div className="amount">₹{PRICE}<span className="per">/month</span></div>
          <div className="sub" style={{ marginTop: 6 }}>You onboard clients from the Revsy admin panel</div>
          <ul>
            <li>WhatsApp review requests on your client’s own BSP</li>
            <li>Google Business Profile review sync</li>
            <li>Positive vs negative trends</li>
            <li>AI recurring-issue insights</li>
            <li>Separate owner admin and client dashboards</li>
          </ul>
          <button className="btn" style={{ width: '100%' }} onClick={() => navigate('/signup')}>
            <Icon.rocket width={18} height={18} /> Get started
          </button>
        </div>
      </section>

      <footer className="land-foot">
        Revsy — review collection and analysis for local businesses.
      </footer>
    </div>
  );
}

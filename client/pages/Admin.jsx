import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Icon } from '../components/Icons.jsx';
import { useToast } from '../components/useToast.jsx';

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS = { trial: { label: 'Trial', cls: 'sent' }, active: { label: 'Active', cls: 'reviewed' }, cancelled: { label: 'Cancelled', cls: 'opened' } };

export default function Admin() {
  const { show, node } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminBusinesses()
      .then((r) => setList(r.businesses))
      .catch((e) => show(e.message))
      .finally(() => setLoading(false));
  }, [show]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <div className="sub">Platform view across all business accounts (single account in this demo).</div>
        </div>
      </div>

      <div className="card">
        <h3>Business accounts</h3>
        <div className="sub">Subscription, usage and account age</div>
        <div className="spacer" />
        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Business</th><th>Owner email</th><th>Status</th><th>Requests sent</th><th>Customers</th><th>Created</th></tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.name}</b></td>
                  <td className="muted">{b.ownerEmail}</td>
                  <td><span className={`badge ${STATUS[b.subscriptionStatus]?.cls || 'sent'}`}>{STATUS[b.subscriptionStatus]?.label || b.subscriptionStatus}</span></td>
                  <td>{b.requestsSent}</td>
                  <td>{b.customersCount}</td>
                  <td className="muted">{fmtDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mb" style={{ marginTop: 16 }}>
        <h3><Icon.shield width={18} height={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Multi-tenant ready</h3>
        <div className="sub" style={{ marginTop: 6 }}>
          Every request, customer and activity is scoped by <code>businessId</code>. Adding more businesses later
          is a data change, not a rewrite — the admin table and all API routes already iterate per business.
        </div>
      </div>
      {node}
    </div>
  );
}

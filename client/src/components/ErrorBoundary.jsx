import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Revsy hit a display error</h1>
            <p style={{ color: '#6b7280', marginBottom: 16 }}>{String(this.state.error.message || this.state.error)}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.location.href = '/';
              }}
              style={{ background: 'var(--accent)', color: '#fff', border: 0, borderRadius: 10, padding: '10px 16px', fontWeight: 700 }}
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

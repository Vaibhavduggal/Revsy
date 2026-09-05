import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth-context.jsx';
import { AdminAuthProvider } from './admin-auth-context.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import App from './App.jsx';
import './styles.css';
import './styles-crm.css';
import './styles-shadcn.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AdminAuthProvider>
            <App />
          </AdminAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

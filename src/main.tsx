import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ProtectedRoute>
      <App />
    </ProtectedRoute>
  </AuthProvider>
);

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Languages, Mic, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';

// Commented out PrivateRoute since we're bypassing authentication.
/* 
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
*/

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI Language Learning Assistant
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Master any language through interactive conversations with our AI tutor.
            Get real-time feedback and personalized lessons.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-blue-500 mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Natural Conversations</h3>
            <p className="text-gray-600">
              Practice real-world conversations with our AI tutor in your target language
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-blue-500 mb-4">
              <Mic size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Voice Interaction</h3>
            <p className="text-gray-600">
              Improve your pronunciation with voice recognition and feedback
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="text-blue-500 mb-4">
              <Languages size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Multiple Languages</h3>
            <p className="text-gray-600">
              Support for various languages and proficiency levels
            </p>
          </div>
        </div>

        <div className="text-center mt-16">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Try It Out
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthForm />} />
          {/* Removed PrivateRoute to allow direct access */}
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
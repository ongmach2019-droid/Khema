import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Map Firebase Auth error codes to user-friendly messages
  const getFriendlyErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'លេខសម្ងាត់ ឬអ៊ីមែលមិនត្រឹមត្រូវ (Invalid password or email). សូមពិនិត្យម្តងទៀត!';
      case 'auth/user-not-found':
        return 'រកមិនឃើញគណនីអ៊ីមែលនេះទេ (User not found). សូមពិនិត្យម្តងទៀត ឬចុះឈ្មោះថ្មី!';
      case 'auth/invalid-email':
        return 'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ (Invalid email format). ឧទាហរណ៍៖ user@example.com';
      case 'auth/email-already-in-use':
        return 'អ៊ីមែលនេះត្រូវបានប្រើប្រាស់រួចហើយ (Email already in use). សូមចូលប្រើប្រាស់ជំនួសវិញ!';
      case 'auth/weak-password':
        return 'លេខសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់ (Password should be at least 6 characters)!';
      case 'auth/too-many-requests':
        return 'ការប៉ុនប៉ងចូលច្រើនដងពេក (Too many attempts). សូមរង់ចាំបន្តិចមុននឹងសាកល្បងម្តងទៀត!';
      case 'auth/network-request-failed':
        return 'បញ្ហាតភ្ជាប់បណ្តាញអ៊ីនធឺណិត (Network error). សូមពិនិត្យការតភ្ជាប់របស់អ្នក!';
      default:
        return 'ការផ្ទៀងផ្ទាត់បរាជ័យ (Authentication failed). សូមព្យាយាមម្តងទៀត!';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Firebase Auth Error:', err);
      const code = err?.code || '';
      setErrorMessage(getFriendlyErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f1f5f9] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 animate-fade-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-100 mb-3">
            <img
              src="/khema-logo.jpg"
              alt="Khema Digital Dental Solution"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isSignUp ? 'បង្កើតគណនីថ្មី (Sign Up)' : 'ចូលគណនី ( Sign In )'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            សៀវភៅកត់ត្រា AI • Khema Digital Dental Solution
          </p>
        </div>

        {/* User-friendly Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5 animate-shake">
            <span className="material-symbols-outlined text-[20px] text-rose-500 shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1 font-medium leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">
              អ៊ីមែល (Email Address)
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px]">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@khemadental.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-teal-600 focus:bg-white focus:ring-1 focus:ring-teal-600 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">
              លេខសម្ងាត់ (Password)
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px]">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-teal-600 focus:bg-white focus:ring-1 focus:ring-teal-600 transition-all font-medium font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Remember me & Forgot password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span>ចងចាំខ្ញុំ (Remember me)</span>
            </label>

            {!isSignUp && (
              <button
                type="button"
                onClick={() => alert('សូមទាក់ទងរដ្ឋបាលមន្ទីរធ្មេញ ខេមា ដើម្បីកំណត់លេខសម្ងាត់ឡើងវិញ។')}
                className="text-teal-700 hover:text-teal-800 font-semibold"
              >
                ភ្លេចលេខសម្ងាត់?
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                <span>កំពុងដំណើរការ...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  {isSignUp ? 'person_add' : 'login'}
                </span>
                <span>{isSignUp ? 'ចុះឈ្មោះគណនីថ្មី' : 'ចូលគណនី'}</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            {isSignUp ? 'មានគណនីរួចហើយ?' : 'មិនទាន់មានគណនីសម្រាប់ប្រើប្រាស់?'}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage('');
              }}
              className="ml-1.5 font-bold text-teal-700 hover:text-teal-800 underline transition-colors cursor-pointer"
            >
              {isSignUp ? 'ចូលគណនីនៅទីនេះ' : 'ចុះឈ្មោះគណនីថ្មីនៅទីនេះ'}
            </button>
          </p>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="mt-6 text-center text-xs text-slate-400">
        © 2026 Khema Digital Dental Solution • All rights reserved
      </div>
    </div>
  );
};

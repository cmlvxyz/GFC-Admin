import React, { useState } from 'react';
import { Shield, X, Loader2 } from 'lucide-react';
import { login } from '../api';

interface LoginPageProps {
  onSuccess: () => void;
  onClose?: () => void;
  apiUrl: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, apiUrl }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      await login(username, password);
      onSuccess();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0a0a14] dark:via-[#0f0f1a] dark:to-[#0a0a14] flex items-center justify-center p-4">
      <div className="w-full min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0a0a14] dark:via-[#0f0f1a] dark:to-[#0a0a14] flex items-center justify-center p-4">
        <div className="bg-white/80 dark:bg-[#1A1A1A]/95 backdrop-blur-xl border border-gray-200 dark:border-indigo-400/30 text-black dark:text-[#F5F5F5] rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl relative">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-xl overflow-hidden">
              <img src="/image.png" alt="GFC Logo" className="w-full h-full object-cover" />
            </div>

            <div>
              <h3 className="text-2xl font-serif text-black dark:text-white">
                GFC-ADMIN
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#A1A1A1] mt-1">
                Gospel Fellowship Church • Management System
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 dark:text-[#A1A1A1] mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 dark:text-[#A1A1A1] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="admin123"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 dark:from-indigo-400 dark:to-indigo-500 dark:hover:brightness-110 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  'Sign In to GFC-ADMIN'
                )}
              </button>
            </form>

            <div className="text-[11px] text-gray-500 dark:text-[#A1A1A1] bg-gray-50 dark:bg-black/30 p-4 rounded-xl border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span className="font-medium">Default Login:</span>
                <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">admin</span>
                <span className="text-gray-400">|</span>
                <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">admin123</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-gray-500 dark:text-gray-400">API: {apiUrl}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
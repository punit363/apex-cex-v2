"use client";

import { useState, useEffect } from "react";
import { login, logout, getActiveUser } from "../utils/httpClient";

export function AuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    console.log("current active user-----------", getActiveUser());
    setCurrentUser(getActiveUser());

    const handleAuthChange = () => {
      setCurrentUser(getActiveUser());
    };

    window.addEventListener("auth_change", handleAuthChange);
    return () => {
      window.removeEventListener("auth_change", handleAuthChange);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential || !password) return;

    setIsSubmitting(true);
    try {
      const payload: { email?: string; user_id?: string; password: string } = {
        password,
      };

      if (credential.includes("@")) {
        payload.email = credential;
      } else {
        payload.user_id = credential;
      }

      await login(payload);
      setIsOpen(false);
      setCredential("");
      setPassword("");
    } catch (err) {
      console.error("Login request failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center">
      {currentUser ? (
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-white">
              {currentUser.first_name || currentUser.user_id}
            </span>
            <span className="text-[10px] text-slate-500">
              {currentUser.email}
            </span>
          </div>
          <button
            onClick={logout}
            className="px-4 py-1.5 rounded-lg border border-slate-800 hover:border-red-500/50 hover:bg-red-500/10 text-xs font-medium text-slate-400 hover:text-red-400 transition-all duration-300"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="px-5 py-2 rounded-lg bg-[#00C278] hover:bg-[#00a868] active:scale-[0.98] text-xs font-semibold text-white transition-all duration-200"
        >
          Sign In
        </button>
      )}

      {/* Auth Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-md bg-[#14151B] border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">
                Welcome Back
              </h2>
              <p className="text-xs text-slate-500">
                Log in using your email address or user ID to start trading.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Email / User ID */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Email or User ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. user_id or email@example.com"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-lg bg-[#1E2026] px-3 text-sm text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-lg bg-[#1E2026] pl-3 pr-10 text-sm text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full h-11 rounded-lg bg-[#00C278] hover:bg-[#00a868] disabled:bg-[#1E2026] text-white disabled:text-slate-600 text-sm font-semibold transition-all duration-200 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Log In"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

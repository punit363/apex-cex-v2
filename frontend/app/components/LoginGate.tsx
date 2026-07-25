"use client";

import { useState } from "react";
import { login, registerUser } from "../utils/httpClient";

interface LoginGateProps {
  onAuthChange: () => void;
}

export function LoginGate({ onAuthChange }: LoginGateProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [credential, setCredential] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential || !loginPassword) return;

    setIsSubmitting(true);
    try {
      const payload: { email?: string; user_id?: string; password: string } = {
        password: loginPassword,
      };

      if (credential.includes("@")) {
        payload.email = credential;
      } else {
        payload.user_id = credential;
      }

      await login(payload);
      setCredential("");
      setLoginPassword("");
      onAuthChange();
    } catch (err) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone || !age || !regPassword)
      return;

    setIsSubmitting(true);
    try {
      await registerUser({
        firstname: firstName,
        lastname: lastName,
        age: Number(age),
        email,
        phone,
        password: regPassword,
      });

      setIsRegister(false);
      setCredential(email);
      setFirstName("");
      setLastName("");
      setPhone("");
      setAge("");
      setRegPassword("");
    } catch (err) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#0E1015] flex flex-col md:flex-row p-0 relative overflow-hidden select-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#00C278]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3b82f6]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="hidden md:flex flex-col justify-between w-1/2 p-12 border-r border-slate-900 bg-[#0E1015]/40 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00C278]/10 border border-[#00C278]/20 rounded-xl">
            <svg
              className="w-6 h-6 text-[#00C278]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-wider uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Apex Exchange
          </span>
        </div>

        <div className="my-auto flex flex-col gap-6 max-w-lg">
          <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
            Trade Liquid Assets with{" "}
            <span className="text-[#00C278]">Microsecond</span> Speeds.
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Experience microsecond trade matching, advanced secure token
            ledgers, and zero fragmentations. Build portfolio positions directly
            on our high-throughput central limit order book.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-[#14151B] border border-slate-800/80 rounded-xl">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                24H Trade Volume
              </p>
              <p className="text-xl font-bold text-white mt-1 tabular-nums">
                $148,390,121
              </p>
            </div>
            <div className="p-4 bg-[#14151B] border border-slate-800/80 rounded-xl">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                Matching Latency
              </p>
              <p className="text-xl font-bold text-[#00C278] mt-1 tabular-nums">
                &lt; 15μs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-[#00C278] animate-pulse" />
          Matching Engine Thread Active & Settle Pipelines Live
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 z-10 bg-[#0E1015]/80">
        <div className="md:hidden flex items-center gap-2 mb-8">
          <div className="p-2 bg-[#00C278]/10 border border-[#00C278]/20 rounded-lg">
            <svg
              className="w-5 h-5 text-[#00C278]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-widest uppercase text-white">
            Apex Exchange
          </span>
        </div>

        <div className="w-full max-w-md bg-[#14151B] border border-slate-800/60 rounded-2xl p-8 shadow-2xl transition-all duration-300">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {isRegister ? "Onboard Terminal" : "Welcome Back"}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5">
              {isRegister
                ? "Initialize your asset credentials to deploy active trades"
                : "Input authorization tokens to connect trading interfaces"}
            </p>
          </div>

          <div className="flex bg-[#0E1015] p-1 rounded-xl mb-6 border border-slate-800/40">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isRegister
                  ? "bg-[#1E2026] text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isRegister
                  ? "bg-[#1E2026] text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Register
            </button>
          </div>

          {!isRegister ? (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                  Email or User ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. user_id or admin@exchange.com"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-lg bg-[#1E2026] px-3.5 text-xs text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-lg bg-[#1E2026] pl-3.5 pr-10 text-xs text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-500 hover:text-slate-350 transition-colors"
                  >
                    {showPassword ? (
                      <svg
                        className="w-4 h-4"
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
                        className="w-4 h-4"
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 w-full h-11 rounded-lg bg-[#00C278] hover:bg-[#00a868] active:scale-[0.99] disabled:bg-[#1E2026] text-white disabled:text-slate-650 text-xs font-semibold tracking-wider uppercase transition-all duration-200 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Connect Account"
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleRegisterSubmit}
              className="flex flex-col gap-3.5"
            >
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-lg bg-[#1E2026] px-3 text-xs text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-lg bg-[#1E2026] px-3 text-xs text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-lg bg-[#1E2026] px-3 text-xs text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Phone
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+15551234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-lg bg-[#1E2026] px-3 text-xs text-white placeholder-slate-600 outline-none border border-transparent focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3.5">
                <div className="col-span-1 flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Age
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="21"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-lg bg-[#1E2026] px-3 text-xs text-white placeholder-slate-650 outline-none border border-transparent focus:border-slate-800 transition"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min. 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-lg bg-[#1E2026] px-3 text-xs text-white placeholder-slate-650 outline-none border border-transparent focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full h-11 rounded-lg bg-[#00C278] hover:bg-[#00a868] active:scale-[0.99] disabled:bg-[#1E2026] text-white disabled:text-slate-650 text-xs font-semibold tracking-wider uppercase transition-all duration-200 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Deploy Profile"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

import { LoginForm } from '@/components/auth/LoginForm';
import { Zap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-gradient-to-br from-[#171a1f] via-[#1e2228] to-[#262b32] text-white p-4 sm:p-6 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -mt-20 -ml-20 size-96 rounded-full bg-[#54a8c7]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 -mb-20 -mr-20 size-96 rounded-full bg-[#3f78e0]/10 blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-3 text-center">
        <div className="size-14 rounded-2xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] p-0.5 shadow-xl shadow-[#54a8c7]/25 flex items-center justify-center">
          <div className="size-full bg-[#1e2228]/80 rounded-[14px] flex items-center justify-center backdrop-blur-xs">
            <Zap className="size-7 text-[#54a8c7] fill-[#54a8c7]" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-heading font-extrabold tracking-tight text-white">
            OCPP <span className="text-[#54a8c7]">CPMS</span>
          </h1>
          <p className="text-xs uppercase font-bold tracking-widest text-[#aab0bc] mt-1">
            Enterprise EV Charge Point Management System
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>

      {/* Footer info */}
      <div className="relative z-10 mt-8 text-center text-xs text-white/50 flex items-center gap-2">
        <ShieldCheck className="size-3.5 text-emerald-400" />
        <span>Secured with OCPP 1.6-J & 2.0.1 Protocol Engine</span>
      </div>
    </div>
  );
}

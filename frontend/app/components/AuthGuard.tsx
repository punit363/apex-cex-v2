"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveUser } from "../utils/httpClient";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const user = getActiveUser();
      
      if (!user) {
        setIsAuthenticated(false);
        router.replace("/");
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

   window.addEventListener("auth_change", checkAuth);
    
    return () => {
      window.removeEventListener("auth_change", checkAuth);
    };
  }, [router]);

 if (isAuthenticated === null) {
    return (
      <div className="min-h-screen w-full bg-[#0E1015] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00C278]/20 border-t-[#00C278] rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium tracking-wide">Syncing terminal...</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
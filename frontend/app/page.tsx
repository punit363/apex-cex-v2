"use client";

import { useState, useEffect } from "react";
import { getActiveUser } from "./utils/httpClient";
import { LoginGate } from "./components/LoginGate";
import Dashboard from "./components/Dashboard";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setCurrentUser(getActiveUser());

    const handleAuthChange = () => {
      setCurrentUser(getActiveUser());
    };

    window.addEventListener("auth_change", handleAuthChange);
    return () => {
      window.removeEventListener("auth_change", handleAuthChange);
    };
  }, []);

  const syncAuthState = () => {
    setCurrentUser(getActiveUser());
  };

  if (!isMounted) return null;

  if (!currentUser) {
    return <LoginGate onAuthChange={syncAuthState} />;
  }

  return <Dashboard />;
}

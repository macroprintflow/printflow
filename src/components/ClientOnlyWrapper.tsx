
"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function ClientOnlyWrapper({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or a loading spinner, or a basic placeholder
  }

  return <>{children}</>;
  
}

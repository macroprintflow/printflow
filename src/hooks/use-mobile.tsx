
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Initialize with a default (e.g., false), which will be used for SSR and initial client render.
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    updateIsMobile(); // Initial check on client mount
    mql.addEventListener("change", updateIsMobile);
    
    return () => mql.removeEventListener("change", updateIsMobile);
  }, []); // Empty dependency array ensures this runs once on mount client-side

  return isMobile; // Directly return the boolean state
}

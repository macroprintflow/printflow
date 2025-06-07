
import Image from 'next/image';

const AppLogo = () => {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative w-32 h-12"> {/* Adjusted: Container for the logo. You can change w-32 (8rem/128px) and h-12 (3rem/48px) */}
        <Image
          src="/images/logo.png" // Assuming this is the correct path
          alt="Macro PrintFlow Logo"
          fill
          style={{ objectFit: 'contain' }} // Ensures aspect ratio is maintained within the container
          priority // Optional: improves LCP for logos
        />
      </div>
      <h1 className="text-lg font-headline text-sidebar-foreground mt-1">
        <span className="font-bold">Macro </span>PrintFlow
      </h1>
    </div>
  );
};

export default AppLogo;

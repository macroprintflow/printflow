
import Image from 'next/image';

const AppLogo = () => {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative w-64 h-24"> {/* Adjusted: Container for the logo. Doubled from w-32 h-12 */}
        <Image
          src="/images/logo.png"
          alt="Macro PrintFlow Logo"
          fill
          style={{ objectFit: 'contain' }} // Ensures aspect ratio is maintained within the container
          priority // Optional: improves LCP for logos
        />
      </div>
      <h1 className="text-lg font-headline text-foreground mt-1"> {/* Changed to text-foreground */}
        <span className="font-bold">Macro </span>PrintFlow
      </h1>
    </div>
  );
};

export default AppLogo;

    

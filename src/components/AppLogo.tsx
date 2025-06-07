
import Image from 'next/image';

const AppLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/images/logo.png" // Path to the new logo in public/images
        alt="Macro PrintFlow Logo"
        width={100} // Adjusted width for a typical logo aspect ratio, can be fine-tuned
        height={28} // h-7 is roughly 28px
        className="h-7 w-auto" // Use w-auto to maintain aspect ratio
      />
      <h1 className="text-xl font-headline font-semibold text-sidebar-foreground">Macro PrintFlow</h1>
    </div>
  );
};

export default AppLogo;

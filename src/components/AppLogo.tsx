
import Image from 'next/image';

const AppLogo = () => {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Image
        src="/images/logo.png"
        alt="Macro PrintFlow Logo"
        width={120} 
        height={34} 
        className="h-auto" 
      />
      <h1 className="text-lg font-headline font-semibold text-sidebar-foreground mt-1">
        Macro PrintFlow
      </h1>
    </div>
  );
};

export default AppLogo;

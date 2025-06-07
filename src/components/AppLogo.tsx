
import Image from 'next/image';

const AppLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/images/logo.png"
        alt="Macro PrintFlow Logo"
        width={128} 
        height={36} 
        className="h-9 w-auto" 
      />
      <h1 className="text-xl font-headline font-semibold text-sidebar-foreground">Macro PrintFlow</h1>
    </div>
  );
};

export default AppLogo;

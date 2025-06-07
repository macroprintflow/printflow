
import Image from 'next/image';

const AppLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/high.png" // Path to the new logo in public folder
        alt="Macro PrintFlow Logo"
        width={100} 
        height={28} 
        className="h-7 w-auto" 
      />
      <h1 className="text-xl font-headline font-semibold text-sidebar-foreground">Macro PrintFlow</h1>
    </div>
  );
};

export default AppLogo;

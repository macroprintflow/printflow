import { Printer } from 'lucide-react';

const AppLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <Printer className="h-7 w-7 text-sidebar-primary" />
      <h1 className="text-xl font-headline font-semibold text-sidebar-foreground">PrintFlow</h1>
    </div>
  );
};

export default AppLogo;

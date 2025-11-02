import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardProps {
  disabled: boolean;
  onCreateNew: () => void;
}

export const Dashboard = ({
  disabled,
  onCreateNew,
  ref,
}: React.ComponentProps<'div'> & DashboardProps) => {
  return (
    <section
      ref={ref}
      inert={disabled}
      className={cn(
        'bg-background fixed inset-0 flex flex-col',
        disabled ? 'z-10' : 'z-20'
      )}
    >
      {/* Header with Create + button */}
      <div className="absolute top-8 right-8">
        <Button 
          variant="primary" 
          size="lg" 
          onClick={onCreateNew}
          className="font-mono"
        >
          create +
        </Button>
      </div>

      {/* Rest of the page is blank for now */}
      <div className="flex-1" />
    </section>
  );
};


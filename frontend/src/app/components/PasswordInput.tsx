import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { cn } from './ui/utils';

export interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  /** Accessible label for the visibility toggle (defaults to "Show password" / "Hide password"). */
  toggleAriaLabel?: string;
}

/**
 * Password field with visibility toggle; forwards ref and input props for forms.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, toggleAriaLabel, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          disabled={disabled}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            toggleAriaLabel ||
            (visible ? 'Hide password' : 'Show password')
          }
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

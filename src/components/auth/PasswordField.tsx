import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, X } from "lucide-react";
import {
  DEFAULT_PASSWORD_POLICY,
  passwordRules,
  passwordStrength,
  STRENGTH_LABELS,
  type PasswordPolicy,
} from "@/lib/password";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  /** Show the live policy checklist and strength meter (sign-up / reset). */
  policy?: PasswordPolicy | null;
  action?: React.ReactNode;
  disabled?: boolean;
}

const BARS = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-amber-400", "bg-emerald-500"];

export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  required,
  error,
  policy,
  action,
  disabled,
}) => {
  const [visible, setVisible] = React.useState(false);
  const rules = policy ? passwordRules(value, policy ?? DEFAULT_PASSWORD_POLICY) : [];
  const score = passwordStrength(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {policy && value ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn("h-full flex-1 rounded-full", index < score ? BARS[score] : "bg-muted")}
                />
              ))}
            </div>
            <span className="w-16 text-right text-xs text-muted-foreground">{STRENGTH_LABELS[score]}</span>
          </div>
          <ul className="space-y-1">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className={cn("flex items-center gap-1.5 text-xs", rule.met ? "text-emerald-600" : "text-muted-foreground")}
              >
                {rule.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {rule.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PasswordField;

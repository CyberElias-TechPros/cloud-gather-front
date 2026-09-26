/** Client-side mirror of the password policy enforced by the API. */
export interface PasswordPolicy {
  min_length: number;
  require_mixed_case: boolean;
  require_number: boolean;
  require_symbol: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  min_length: 8,
  require_mixed_case: false,
  require_number: false,
  require_symbol: false,
};

export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

/** Explodes a policy into individually checkable rules for live feedback. */
export function passwordRules(value: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): PasswordRule[] {
  const rules: PasswordRule[] = [
    { id: "length", label: `At least ${policy.min_length} characters`, met: value.length >= policy.min_length },
  ];
  if (policy.require_mixed_case) {
    rules.push({
      id: "case",
      label: "Upper and lower case letters",
      met: /[a-z]/.test(value) && /[A-Z]/.test(value),
    });
  }
  if (policy.require_number) {
    rules.push({ id: "number", label: "At least one number", met: /\d/.test(value) });
  }
  if (policy.require_symbol) {
    rules.push({ id: "symbol", label: "At least one symbol", met: /[^A-Za-z0-9]/.test(value) });
  }
  return rules;
}

/** First unmet requirement, or null when the password satisfies the policy. */
export function validatePassword(value: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): string | null {
  const failed = passwordRules(value, policy).find((rule) => !rule.met);
  return failed ? failed.label : null;
}

/** Rough 0–4 strength score used only to colour the meter. */
export function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

export const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

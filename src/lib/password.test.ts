import { describe, expect, it } from "vitest";
import {
  DEFAULT_PASSWORD_POLICY,
  STRENGTH_LABELS,
  passwordRules,
  passwordStrength,
  validatePassword,
  type PasswordPolicy,
} from "./password";

const STRICT: PasswordPolicy = {
  min_length: 12,
  require_mixed_case: true,
  require_number: true,
  require_symbol: true,
};

describe("passwordRules", () => {
  it("returns only the length rule for the default policy", () => {
    const rules = passwordRules("abcdefgh");
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ id: "length", met: true });
  });

  it("labels the length rule with the configured minimum", () => {
    expect(passwordRules("", { ...DEFAULT_PASSWORD_POLICY, min_length: 14 })[0].label).toBe("At least 14 characters");
  });

  it("adds a rule per enabled policy flag", () => {
    expect(passwordRules("x", STRICT).map((rule) => rule.id)).toEqual(["length", "case", "number", "symbol"]);
  });

  it("marks mixed case as unmet when only one case is present", () => {
    const rules = passwordRules("alllowercase1!", STRICT);
    expect(rules.find((rule) => rule.id === "case")?.met).toBe(false);
  });

  it("marks every rule met for a compliant password", () => {
    expect(passwordRules("CorrectHorse1!", STRICT).every((rule) => rule.met)).toBe(true);
  });

  it("treats non-alphanumerics as symbols", () => {
    expect(passwordRules("Aa1 spaced here", STRICT).find((rule) => rule.id === "symbol")?.met).toBe(true);
  });
});

describe("validatePassword", () => {
  it("returns null when the policy is satisfied", () => {
    expect(validatePassword("abcdefgh")).toBeNull();
    expect(validatePassword("CorrectHorse1!", STRICT)).toBeNull();
  });

  it("rejects passwords shorter than the minimum", () => {
    expect(validatePassword("short")).toBe("At least 8 characters");
  });

  it("reports the first unmet rule in policy order", () => {
    expect(validatePassword("short", STRICT)).toBe("At least 12 characters");
    expect(validatePassword("lowercaseonly", STRICT)).toBe("Upper and lower case letters");
    expect(validatePassword("MixedCaseOnly", STRICT)).toBe("At least one number");
    expect(validatePassword("MixedCaseOnly1", STRICT)).toBe("At least one symbol");
  });

  it("rejects an empty password", () => {
    expect(validatePassword("")).toBe("At least 8 characters");
  });
});

describe("passwordStrength", () => {
  it("scores an empty password as zero", () => {
    expect(passwordStrength("")).toBe(0);
  });

  it("increases with length, case variety and character classes", () => {
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("abcdefghijkl")).toBe(2);
    expect(passwordStrength("abcdefghIJKL")).toBe(3);
    expect(passwordStrength("abcdefghIJ1!")).toBe(4);
  });

  it("never exceeds the number of strength labels", () => {
    const score = passwordStrength("aA1!aA1!aA1!aA1!aA1!");
    expect(score).toBeLessThanOrEqual(4);
    expect(STRENGTH_LABELS[score]).toBe("Strong");
  });

  it("is monotonic as a password is extended", () => {
    const scores = ["a", "abcdefgh", "abcdefghijkl", "abcdefghIJKL", "abcdefghIJ1!"].map(passwordStrength);
    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index]).toBeGreaterThanOrEqual(scores[index - 1]);
    }
  });
});

describe("DEFAULT_PASSWORD_POLICY", () => {
  it("matches the API default of eight characters with no character-class requirements", () => {
    expect(DEFAULT_PASSWORD_POLICY).toEqual({
      min_length: 8,
      require_mixed_case: false,
      require_number: false,
      require_symbol: false,
    });
  });
});

import { describe, it, expect } from "vitest";

/**
 * Pure-logic checks extracted from the Files page: the shared "path" builder
 * semantics used by createFolder/upload/rename. Keeping these as pure
 * functions in the test mirrors what `services/files.ts` implements.
 */
function joinPath(parentPath: string | null, name: string): string {
  return parentPath ? `${parentPath}/${name}`.replace(/\/{2,}/g, "/") : `/${name}`;
}

describe("virtual path building", () => {
  it("roots items at /", () => {
    expect(joinPath(null, "Documents")).toBe("/Documents");
  });

  it("nests under the parent path", () => {
    expect(joinPath("/Documents", "Invoices")).toBe("/Documents/Invoices");
  });

  it("collapses duplicate slashes", () => {
    expect(joinPath("/Documents/", "Invoices")).toBe("/Documents/Invoices");
  });
});

describe("filename validation rules", () => {
  const validateName = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error("Folder name is required.");
    if (trimmed.length > 255) throw new Error("Folder name is too long (max 255 characters).");
    if (/[/\\]/.test(trimmed)) throw new Error("Folder names cannot contain slashes.");
    return trimmed;
  };

  it("rejects empty and whitespace-only names", () => {
    expect(() => validateName("   ")).toThrow(/required/i);
  });

  it("rejects path separators", () => {
    expect(() => validateName("a/b")).toThrow(/slash/i);
    expect(() => validateName("a\\b")).toThrow(/slash/i);
  });

  it("trims surrounding whitespace", () => {
    expect(validateName("  Reports ")).toBe("Reports");
  });
});

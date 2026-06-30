import { describe, expect, it } from "vitest";

import { formatMoney, fromMinor, toMinor } from "@/lib/money";

describe("money minor-unit math (no floats)", () => {
  it("toMinor: major → integer minor units", () => {
    expect(toMinor(10, "SAR")).toBe(1000);
    expect(toMinor(1.5, "SAR")).toBe(150);
    expect(toMinor(0, "EGP")).toBe(0);
    expect(toMinor(12.34, "EGP")).toBe(1234);
  });

  it("fromMinor: minor → major units", () => {
    expect(fromMinor(1000, "SAR")).toBe(10);
    expect(fromMinor(150, "SAR")).toBe(1.5);
    expect(fromMinor(99, "EGP")).toBe(0.99);
  });

  it("round-trips minor → major → minor", () => {
    expect(toMinor(fromMinor(2599, "SAR"), "SAR")).toBe(2599);
  });
});

describe("formatMoney (locale + currency)", () => {
  it("en: Latin digits + currency for SAR/EGP", () => {
    const sar = formatMoney(1000, "SAR", "en");
    expect(sar).toContain("10.00");
    expect(sar).toMatch(/SAR|ر\.?س/);

    const egp = formatMoney(2000, "EGP", "en");
    expect(egp).toContain("20.00");
    expect(egp).toMatch(/EGP|E£/);
  });

  it("ar: Arabic currency symbol, distinct from en (digit script left to ICU)", () => {
    // Digit script (Arabic-Indic vs Latin) varies by runtime ICU, so we assert the
    // CLDR-stable Arabic currency symbol + that ar differs from en — not the digits.
    const arSar = formatMoney(1000, "SAR", "ar");
    expect(arSar).toMatch(/ر\.?س/);
    expect(arSar).not.toBe(formatMoney(1000, "SAR", "en"));

    const arEgp = formatMoney(2000, "EGP", "ar");
    expect(arEgp).toMatch(/ج\.?م/);
  });
});

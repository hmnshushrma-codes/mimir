import { describe, expect, it } from "vitest";
import { lighten, contrastCapColor } from "./colorUtils.js";

describe("lighten", () => {
  it("returns the same color at amount 0", () => {
    expect(lighten("#2a78d6", 0)).toBe("#2a78d6");
  });

  it("returns white at amount 1", () => {
    expect(lighten("#2a78d6", 1)).toBe("#ffffff");
  });

  it("moves each channel toward 255 for an intermediate amount", () => {
    const result = lighten("#000000", 0.5);
    expect(result).toBe("#808080");
  });
});

describe("contrastCapColor", () => {
  it("returns dark cap for light body colors", () => {
    expect(contrastCapColor("#ffffff")).toBe("#1b1d23");
    expect(contrastCapColor("#eda100")).toBe("#1b1d23"); // yellow — bright
  });

  it("returns light cap for dark body colors", () => {
    expect(contrastCapColor("#000000")).toBe("#f0f0f0");
    expect(contrastCapColor("#1b1d23")).toBe("#f0f0f0"); // near-black
    expect(contrastCapColor("#2a78d6")).toBe("#f0f0f0"); // blue — dark enough
  });
});

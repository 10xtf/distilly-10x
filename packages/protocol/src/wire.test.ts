import { describe, expect, it } from "vitest";

import { WIRE_VERSION, wireVersionSchema } from "./index.js";

describe("protocol workspace foundation", () => {
  it("accepts the frozen V3 wire major", () => {
    expect(wireVersionSchema.parse(WIRE_VERSION)).toBe("3");
  });

  it.each(["2", "03", 3, null])("rejects a non-V3 wire major: %j", (value) => {
    expect(() => wireVersionSchema.parse(value)).toThrow();
  });

  it("keeps the package root intentionally minimal", async () => {
    const protocol = await import("./index.js");

    expect(Object.keys(protocol).sort()).toEqual(["WIRE_VERSION", "wireVersionSchema"]);
  });
});

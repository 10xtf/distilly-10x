import assert from "node:assert/strict";

const protocol = await import("@distilly/protocol");

assert.deepEqual(
  Object.keys(protocol).sort(),
  ["WIRE_VERSION", "wireVersionSchema"],
  "Packed root runtime exports must match the reviewed allowlist",
);
assert.equal(protocol.WIRE_VERSION, "3");
assert.equal(protocol.wireVersionSchema.parse("3"), "3");
assert.throws(() => protocol.wireVersionSchema.parse("2"));

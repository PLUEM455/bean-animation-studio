import { test } from "node:test";
import assert from "node:assert/strict";
import { toolKindFor, toolMatches, collectVein } from "../Veincapitator_BP/scripts/veinCore.js";
import { clampLimit, DEFAULTS } from "../Veincapitator_BP/scripts/settings.js";

test("toolKindFor maps ores to pickaxe and logs to axe", () => {
  assert.equal(toolKindFor("minecraft:iron_ore"), "pickaxe");
  assert.equal(toolKindFor("minecraft:deepslate_diamond_ore"), "pickaxe");
  assert.equal(toolKindFor("minecraft:ancient_debris"), "pickaxe");
  assert.equal(toolKindFor("minecraft:oak_log"), "axe");
  assert.equal(toolKindFor("minecraft:crimson_stem"), "axe");
  assert.equal(toolKindFor("minecraft:stone"), null);
  assert.equal(toolKindFor(undefined), null);
});

test("toolMatches checks the held tool type", () => {
  assert.equal(toolMatches("minecraft:iron_pickaxe", "pickaxe"), true);
  assert.equal(toolMatches("minecraft:iron_axe", "pickaxe"), false);
  assert.equal(toolMatches(undefined, "axe"), false);
});

test("collectVein finds a connected cluster but not separate blocks", () => {
  const solid = new Set(["1,0,0", "1,1,0", "2,1,1", "5,0,0"]); // 5,0,0 is disconnected
  const matches = (p) => solid.has(`${p.x},${p.y},${p.z}`);
  const found = collectVein({ x: 0, y: 0, z: 0 }, matches, 100).map((p) => `${p.x},${p.y},${p.z}`);
  assert.deepEqual(found.sort(), ["1,0,0", "1,1,0", "2,1,1"]);
});

test("collectVein follows diagonal connections", () => {
  const solid = new Set(["1,1,1"]); // only diagonal from origin
  const matches = (p) => solid.has(`${p.x},${p.y},${p.z}`);
  assert.equal(collectVein({ x: 0, y: 0, z: 0 }, matches, 10).length, 1);
});

test("collectVein stops at maxBlocks", () => {
  const matches = (p) => p.x >= 0 && p.x < 10 && p.y === 0 && p.z === 0;
  const found = collectVein({ x: -1, y: 0, z: 0 }, matches, 3);
  assert.equal(found.length, 3);
});

test("collectVein does not include the start position", () => {
  const matches = () => true;
  const found = collectVein({ x: 0, y: 0, z: 0 }, matches, 5);
  assert.ok(!found.some((p) => p.x === 0 && p.y === 0 && p.z === 0));
});

test("clampLimit keeps the value in range and falls back on junk", () => {
  assert.equal(clampLimit(0), 1);
  assert.equal(clampLimit(9999), 256);
  assert.equal(clampLimit("12"), 12);
  assert.equal(clampLimit("abc"), DEFAULTS.limit);
});

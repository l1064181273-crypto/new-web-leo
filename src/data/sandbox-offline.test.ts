/// <reference types="node" />
import { execFileSync } from "node:child_process";
import template from "../../sandbox/index.html?raw";
import css from "../../sandbox/style.css?raw";
import { describe, expect, it } from "vitest";

describe("Little Works offline artifact", () => {
  it("bundles the real scene as one classic script with no unresolved or external dependencies", () => {
    // The repository's shared test setup requires jsdom. Run the build in a
    // separate Node realm so esbuild receives native, not jsdom, typed arrays.
    const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { build } from "esbuild";
      import { Script } from "node:vm";
      const result = await build({ entryPoints: ["sandbox/scene.js"], bundle: true, write: false, metafile: true, format: "iife", minify: true, target: "chrome110", alias: { three: "three-r160" }, legalComments: "inline" });
      const script = result.outputFiles[0].text;
      new Script(script);
      console.log(JSON.stringify({ imports: Object.values(result.metafile.outputs).flatMap(output => output.imports), hasStatusHandshake: script.includes("little-works-status-request"), bytes: script.length }));
    `], { encoding: "utf8" }));
    expect(result.imports).toEqual([]);
    expect(result.hasStatusHandshake).toBe(true);
    expect(result.bytes).toBeGreaterThan(100000);
    expect(template).not.toMatch(/<(?:script|img|source|iframe|audio|video)\b[^>]*\bsrc\s*=/i);
    expect(template).not.toMatch(/<link\b[^>]*\bhref\s*=/i);
    expect(css).not.toMatch(/@import|url\(\s*["']?(?!data:)[^\s)]/i);
  });
});

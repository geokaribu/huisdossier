import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { wallCoatings } from "../src/wallCoatings.ts";

test("wallpaper scale stays continuous across wall pieces on either face", () => {
  const texture = new THREE.Texture();
  for (const side of ["positive", "negative"]) {
    const wall = {
      a: [0, 0],
      b: [4, 0],
      thickness: 0.1,
      openings: [],
      coatings: [
        {
          side,
          from: 0,
          to: 4,
          color: "#ffffff",
          pattern: {
            texture: "wallpaper.png",
            tileSize: [1.4, 1.4],
            attribution: "Synthetic",
            generated: true,
          },
        },
      ],
    };
    for (const [from, to] of [
      [0, 1.3],
      [1.3, 4],
    ]) {
      const group = wallCoatings(
        wall,
        from,
        to,
        1,
        2.6,
        new Map([["wallpaper.png", texture]]),
      );
      group.updateMatrixWorld(true);
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        assert.equal(o.material.map, texture);
        const pos = o.geometry.getAttribute("position"),
          uv = o.geometry.getAttribute("uv");
        for (let i = 0; i < pos.count; i++) {
          const p = new THREE.Vector3()
            .fromBufferAttribute(pos, i)
            .applyMatrix4(o.matrix);
          assert.ok(Math.abs(uv.getX(i) * 1.4 - p.x) < 1e-6);
          assert.ok(Math.abs(uv.getY(i) * 1.4 - p.y) < 1e-6);
        }
        o.geometry.dispose();
        o.material.dispose();
      });
    }
  }
  texture.dispose();
});

test("wall paint keeps separate faces, clips the dado and leaves doorways empty", () => {
  const wall = {
    a: [1, 2],
    b: [1, 6],
    thickness: 0.1,
    openings: [],
    coatings: [
      {
        side: "positive",
        from: 0,
        to: 4,
        color: "#eee9df",
        lower: { color: "#a04e36", height: 1.18, railColor: "#89432f" },
      },
      { side: "negative", from: 2, to: 4, color: "#b99eaa" },
    ],
  };
  const scene = new THREE.Scene();
  // Solid wall pieces surrounding a door at offsets 1..2, height 2.12 m.
  for (const [from, to, bottom, top] of [
    [0, 1, 0, 2.64],
    [1, 2, 2.12, 2.64],
    [2, 4, 0, 2.64],
  ])
    scene.add(wallCoatings(wall, from, to, bottom, top));
  scene.updateMatrixWorld(true);
  function hit(x, y, z, direction) {
    return new THREE.Raycaster(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(direction, 0, 0),
    ).intersectObjects(scene.children, true)[0];
  }
  assert.equal(
    hit(0, 0.5, 2.5, 1).object.material.color.getHexString(),
    "a04e36",
  );
  assert.equal(
    hit(0, 1.8, 2.5, 1).object.material.color.getHexString(),
    "eee9df",
  );
  assert.equal(
    hit(2, 0.5, 5, -1).object.material.color.getHexString(),
    "b99eaa",
  );
  assert.equal(
    hit(2, 0.5, 2.5, -1),
    undefined,
    "bedroom paint stops at its configured room boundary",
  );
  assert.equal(
    hit(0, 0.8, 3.5, 1),
    undefined,
    "doorway is empty at walking height",
  );
  assert.ok(hit(0, 2.4, 3.5, 1), "wall above doorway is painted");
  const rails = [];
  scene.traverse((o) => {
    if (o.userData.role === "paint-divider-rail") rails.push(o);
  });
  assert.equal(rails.length, 2, "the divider does not cross the doorway");
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
});

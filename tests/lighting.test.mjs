import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  dutchInstant,
  solarPosition,
  sunDirection,
  activeLampIds,
  lampIntensity,
} from "../src/lighting.ts";
import { contextBuildings, createLightingRig } from "../src/lightingScene.ts";
import { activeLightMasts } from "../scripts/lighting-source.mjs";
import { createApp } from "../server/app.mjs";
import { triangulateSurface } from "../src/geometry.ts";

const scenario = {
  height: 4,
  lumens: 1200,
  kelvin: 3000,
  distribution: "point",
};
const profile = {
  version: 1,
  latitude: 52,
  longitude: 5,
  timeZone: "Europe/Amsterdam",
  source: {
    url: "https://example.org/source",
    attribution: "Synthetic BGT",
    license: "CC0",
    fetchedAt: "2026-11-20",
    note: "Assumptions",
  },
  lamps: [
    {
      id: "a",
      label: "A",
      rd: [10, 0],
      sourceType: "lichtmast",
      armatureType: null,
      sourceDate: null,
      scenario,
    },
    {
      id: "b",
      label: "B",
      rd: [20, 0],
      sourceType: "lichtmast",
      armatureType: null,
      sourceDate: null,
      scenario,
    },
    {
      id: "c",
      label: "C",
      rd: [30, 0],
      sourceType: "lichtmast",
      armatureType: null,
      sourceDate: null,
      scenario,
    },
    {
      id: "d",
      label: "D",
      rd: [40, 0],
      sourceType: "lichtmast",
      armatureType: null,
      sourceDate: null,
      scenario,
    },
  ],
};
const surface = {
  type: "WallSurface",
  rings: [
    [
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 6],
      [0, 0, 6],
    ],
  ],
};
const data = {
  house: { rd: [0, 0] },
  buildings: [
    { target: true, surfaces: [surface] },
    { target: false, surfaces: [surface] },
  ],
};

test("BAG triangle normals retain source winding on every projection axis", () => {
  for (const ring of [
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
    ],
  ]) {
    for (const points of [ring, [...ring].reverse()]) {
      const p = points.map(([x, y, z]) => new THREE.Vector3(x, z, -y));
      const expected = p[1]
        .clone()
        .sub(p[0])
        .cross(p[2].clone().sub(p[0]))
        .normalize();
      const geometry = triangulateSurface(
        { type: "WallSurface", rings: [points] },
        [0, 0, 0],
      );
      const normal = new THREE.Vector3().fromBufferAttribute(
        geometry.attributes.normal,
        0,
      );
      assert.ok(normal.dot(expected) > 0.99999);
    }
  }
});

test("Dutch solar time handles seasons, DST gaps and invalid dates independently of host zone", () => {
  assert.equal(
    dutchInstant("2026-01-15", "12:00").toISOString(),
    "2026-01-15T11:00:00.000Z",
  );
  assert.equal(
    dutchInstant("2026-07-15", "12:00").toISOString(),
    "2026-07-15T10:00:00.000Z",
  );
  assert.equal(dutchInstant("2026-03-29", "02:30"), null);
  assert.equal(dutchInstant("2026-02-31", "12:00"), null);
  assert.equal(
    dutchInstant("2026-10-25", "02:30")?.toISOString(),
    "2026-10-25T01:30:00.000Z",
  );
  const winter = solarPosition(profile, { date: "2026-12-21", time: "12:00" }),
    summer = solarPosition(profile, { date: "2026-06-21", time: "12:00" });
  assert.ok(winter.altitude > 10 && winter.altitude < 20);
  assert.ok(summer.altitude > 50 && summer.altitude < 65);
  assert.ok(
    solarPosition(profile, { date: "2026-11-20", time: "23:00" }).altitude < 0,
  );
  assert.deepEqual(sunDirection(0, 0), [0, 0, -1]);
  assert.ok(
    new THREE.Vector3(...sunDirection(90, 0)).distanceTo(
      new THREE.Vector3(1, 0, 0),
    ) < 1e-10,
  );
});

test("BGT selection excludes terminated and superseded mast versions, other pole types and distant objects", () => {
  const f = (id, extra = {}, coords = [0, 0]) => ({
    properties: {
      lokaal_id: id,
      plus_type: "lichtmast",
      status: "bestaand",
      tijdstip_registratie: "2026-01-01",
      ...extra,
    },
    geometry: { type: "Point", coordinates: coords },
  });
  const selected = activeLightMasts(
    [
      f("a"),
      f("a", { tijdstip_registratie: "2026-02-01" }),
      f("b", { eind_registratie: "2026-04-01" }),
      f("c", { termination_date: "2026-04-01" }),
      f("d", { plus_type: "verkeersbordpaal" }),
      f("e", {}, [100, 100]),
      f("f", { status: "plan" }),
    ],
    [0, 0],
    50,
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].properties.tijdstip_registratie, "2026-02-01");
  assert.deepEqual(activeLampIds(profile, "d", [0, 0]), ["d", "a", "b"]);
  assert.ok(lampIntensity(1200, "downward") > lampIntensity(1200, "point"));
});

test("one registered rig switches day/night, limits shadowed sources and restores the illustrative view", () => {
  const scene = new THREE.Scene(),
    oldLight = new THREE.DirectionalLight("white", 2);
  scene.add(oldLight);
  const indoorBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.04),
    new THREE.MeshStandardMaterial({
      emissive: "#ffac40",
      emissiveIntensity: 1.4,
    }),
  );
  indoorBulb.userData.indoorBulb = true;
  scene.add(indoorBulb);
  scene.background = new THREE.Color("#eee9de");
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 }),
  );
  glass.castShadow = true;
  scene.add(glass);
  const texture = new THREE.Texture();
  texture.userData.bakedLighting = true;
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshStandardMaterial({ map: texture }),
  );
  scene.add(photo);
  const renderer = {
    toneMappingExposure: 1.1,
    shadowMap: { autoUpdate: true },
  };
  const rig = createLightingRig(scene, renderer, data, () => {});
  const settings = {
    enabled: true,
    date: "2026-11-20",
    time: "23:00",
    neighbors: true,
    streetLights: true,
    indoorLights: false,
    selectedLampId: "d",
    exposure: 2,
  };
  rig.update(profile, settings);
  scene.updateMatrixWorld(true);
  const lights = [];
  scene.traverseVisible((o) => {
    if (o instanceof THREE.PointLight) lights.push(o);
  });
  assert.equal(lights.length, 3);
  assert.equal(oldLight.visible, false);
  assert.equal(indoorBulb.material.emissiveIntensity, 0);
  assert.equal(glass.castShadow, false);
  assert.equal(photo.material.map, null);
  assert.equal(lights[0].getWorldPosition(new THREE.Vector3()).y, 4);
  assert.equal(renderer.toneMappingExposure, 2);
  rig.update(profile, { ...settings, streetLights: false });
  let count = 0;
  scene.traverseVisible((o) => {
    if (o instanceof THREE.PointLight) count++;
  });
  assert.equal(count, 0);
  rig.update(profile, { ...settings, enabled: false });
  assert.equal(indoorBulb.material.emissiveIntensity, 1.4);
  assert.equal(oldLight.visible, true);
  assert.equal(oldLight.intensity, 2);
  assert.equal(glass.castShadow, true);
  assert.equal(renderer.toneMappingExposure, 1.1);
  assert.equal(photo.material.map, texture);
  photo.material.map = null; // The user subsequently disables facade styling.
  rig.update(profile, { ...settings, enabled: false });
  assert.equal(photo.material.map, null);
  rig.dispose();
});

test("neighbor meshes share the inverse plan registration, and the own upper shell is clipped above the room ceiling", () => {
  const matrix = new THREE.Matrix4()
    .makeRotationY(Math.PI / 2)
    .setPosition(3, 0, 7);
  const group = contextBuildings(data, [0, 0, 0], matrix, 2.665);
  assert.equal(group.children.length, 2);
  const neighbor = group.children.find((o) => !o.userData.upperFloor),
    upper = group.children.find((o) => o.userData.upperFloor);
  const v = new THREE.Vector3().fromBufferAttribute(
    neighbor.geometry.attributes.position,
    0,
  );
  assert.ok(Math.abs(v.x - 3) < 1e-6);
  assert.ok(
    upper.material.clippingPlanes[0].distanceToPoint(
      new THREE.Vector3(0, 2, 0),
    ) < 0,
  );
  assert.ok(
    upper.material.clippingPlanes[0].distanceToPoint(
      new THREE.Vector3(0, 3, 0),
    ) > 0,
  );
  assert.equal(upper.material.clipShadows, true);
  assert.equal(neighbor.castShadow, true);
});

test("lighting API validates scenarios, isolates houses and preserves source facts under simultaneous saves", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "huisdossier-light-"));
  const root = path.join(directory, "root");
  await mkdir(path.join(root, "public", "data"), { recursive: true });
  await writeFile(
    path.join(root, "public", "data", "synthetic.json"),
    JSON.stringify({ ...data, house: { ...data.house, id: "synthetic" } }),
  );
  const { app, store } = createApp({
    directory,
    root,
    houses: [
      { id: "synthetic", name: "Test" },
      { id: "empty", name: "Empty" },
    ],
  });
  await mkdir(path.join(directory, "lighting", "synthetic"), {
    recursive: true,
  });
  await writeFile(
    path.join(directory, "lighting", "synthetic", "profile.json"),
    JSON.stringify(profile),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  const patch = (id, value, house = "synthetic") =>
    fetch(`${base}/${house}/lighting/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  try {
    assert.equal(await (await fetch(`${base}/empty/lighting`)).json(), null);
    assert.equal((await patch("a", scenario, "empty")).status, 404);
    assert.equal((await patch("missing", scenario)).status, 404);
    assert.equal((await patch("a", { ...scenario, height: -1 })).status, 400);
    const results = await Promise.all([
      patch("a", { ...scenario, height: 5 }),
      patch("b", { ...scenario, lumens: 900 }),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    const saved = await (await fetch(`${base}/synthetic/lighting`)).json();
    assert.equal(saved.lamps[0].scenario.height, 5);
    assert.equal(saved.lamps[1].scenario.lumens, 900);
    assert.deepEqual(saved.source, profile.source);
    assert.deepEqual(saved.lamps[0].rd, profile.lamps[0].rd);
    assert.equal(saved.lamps[0].armatureType, null);
    const exported = await (await fetch(`${base}/synthetic/export`)).json();
    assert.deepEqual(exported.lighting, saved);
    assert.equal((await fetch(`${base}/unknown/lighting`)).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

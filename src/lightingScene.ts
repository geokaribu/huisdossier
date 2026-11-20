import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { triangulateSurface } from "./geometry.ts";
import { planToExterior } from "./houseEnvelope.ts";
import {
  activeLampIds,
  coneAngle,
  lampIntensity,
  solarPosition,
  sunDirection,
} from "./lighting.ts";
import type {
  Floorplan,
  HouseAppearance,
  HouseData,
  LightingEnvironment,
  LightingSettings,
  Point,
} from "./types.ts";

export function modelOrigin(data: HouseData): Point {
  const target = data.buildings.find((b) => b.target)!;
  return [
    ...data.house.rd,
    Math.min(
      ...target.surfaces.flatMap((s) => s.rings.flat().map((p) => p[2])),
    ),
  ];
}

/** One draw call per material, including for each of the six point-light shadow faces. */
export function contextBuildings(
  data: HouseData,
  origin: Point,
  transform = new THREE.Matrix4(),
  ownUpperFloor?: number,
) {
  const group = new THREE.Group();
  for (const target of [false, true]) {
    if (target && ownUpperFloor === undefined) continue;
    const geometries: THREE.BufferGeometry[] = [];
    for (const building of data.buildings.filter((b) => b.target === target)) {
      for (const surface of building.surfaces) {
        const geometry = triangulateSurface(surface, origin);
        if (geometry) geometries.push(geometry.applyMatrix4(transform));
      }
    }
    if (!geometries.length) continue;
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    const material = new THREE.MeshStandardMaterial({
      color: target ? "#dedace" : "#bbbcae",
      roughness: 1,
      side: THREE.DoubleSide,
      clipShadows: true,
      clippingPlanes: target
        ? [new THREE.Plane(new THREE.Vector3(0, 1, 0), -ownUpperFloor!)]
        : null,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.upperFloor = target;
    group.add(mesh);
  }
  return group;
}

function kelvinColor(k: number) {
  const t = k / 100;
  const clamp = (n: number) => Math.min(255, Math.max(0, n)) / 255;
  return new THREE.Color().setRGB(
    clamp(t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)),
    clamp(
      t <= 66
        ? 99.4708025861 * Math.log(t) - 161.1195681661
        : 288.1221695283 * Math.pow(t - 60, -0.0755148492),
    ),
    clamp(
      t >= 66
        ? 255
        : t <= 19
          ? 0
          : 138.5177312231 * Math.log(t - 10) - 305.0447927307,
    ),
    THREE.SRGBColorSpace,
  );
}

export interface LightingRig {
  update: (
    profile: LightingEnvironment | null,
    settings: LightingSettings,
  ) => void;
  dispose: () => void;
}

/** The same RD-registered light sources drive the outside and inside views. */
export function createLightingRig(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  data: HouseData,
  invalidate: () => void,
  interior?: { appearance: HouseAppearance; plan: Floorplan },
): LightingRig {
  // Camera movement does not move these light sources or their shadow casters.
  // Recompute shadows on scenario, geometry, ceiling or door changes only.
  renderer.shadowMap.autoUpdate = false;
  const origin = modelOrigin(data),
    transform = interior
      ? planToExterior(interior.appearance, origin).invert()
      : new THREE.Matrix4();
  const baseline: {
    light: THREE.Light;
    intensity: number;
    visible: boolean;
  }[] = [];
  const glass: { mesh: THREE.Mesh; cast: boolean }[] = [];
  const photographed = new Map<THREE.MeshStandardMaterial, THREE.Texture>();
  scene.traverse((o) => {
    if (o instanceof THREE.Light)
      baseline.push({ light: o, intensity: o.intensity, visible: o.visible });
    if (
      o instanceof THREE.Mesh &&
      (Array.isArray(o.material) ? o.material : [o.material]).every(
        (m) => m.transparent && m.opacity < 0.8,
      )
    )
      glass.push({ mesh: o, cast: o.castShadow });
    if (o instanceof THREE.Mesh)
      for (const material of Array.isArray(o.material)
        ? o.material
        : [o.material]) {
        if (
          material instanceof THREE.MeshStandardMaterial &&
          material.map?.userData.bakedLighting
        )
          photographed.set(material, material.map);
      }
  });
  const original = {
    background: scene.background,
    fog: scene.fog,
    exposure: renderer.toneMappingExposure,
    environment: scene.environmentIntensity,
  };
  const group = new THREE.Group();
  group.name = "Georegistered lighting";
  scene.add(group);
  const center = new THREE.Vector3(0, 1, 0).applyMatrix4(transform);
  const sun = new THREE.DirectionalLight("#fff2d9", 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -27,
    right: 27,
    top: 27,
    bottom: -27,
    near: 0.1,
    far: 240,
  });
  sun.shadow.bias = -0.00003;
  sun.shadow.normalBias = 0.012;
  sun.target.position.copy(center);
  group.add(sun, sun.target);
  const sky = new THREE.HemisphereLight("#b8d8fa", "#564f45", 0.15);
  group.add(sky);
  const context = interior
    ? contextBuildings(
        data,
        origin,
        transform,
        interior.plan.ceilingHeight + 0.025,
      )
    : null;
  if (context) group.add(context);
  if (interior) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: "#98988e", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.16;
    ground.receiveShadow = true;
    group.add(ground);
  }
  const sources = new Map<
    string,
    {
      group: THREE.Group;
      pole: THREE.Mesh;
      bulb: THREE.Mesh;
      point: THREE.PointLight;
      spot: THREE.SpotLight;
    }
  >();
  let enabled = false;
  const update: LightingRig["update"] = (profile, settings) => {
    renderer.shadowMap.needsUpdate = true;
    const solar = profile && solarPosition(profile, settings);
    const on = Boolean(settings.enabled && solar);
    if (on || enabled)
      photographed.forEach((map, material) => {
        const next = on ? null : map;
        if (material.map !== next) {
          material.map = next;
          material.needsUpdate = true;
        }
      });
    group.visible = on;
    if (!on) {
      baseline.forEach(({ light, intensity, visible }) => {
        light.intensity = intensity;
        light.visible = visible;
      });
      glass.forEach(({ mesh, cast }) => (mesh.castShadow = cast));
      renderer.toneMappingExposure = original.exposure;
      scene.environmentIntensity = original.environment;
      if (enabled) {
        scene.background = original.background;
        scene.fog = original.fog;
      }
      enabled = false;
      invalidate();
      return;
    }
    enabled = true;
    const altitude = solar!.altitude,
      day = altitude > 0;
    baseline.forEach(({ light, intensity }) => {
      light.intensity =
        settings.indoorLights && light instanceof THREE.PointLight
          ? intensity
          : 0;
      light.visible = light.intensity > 0;
    });
    // Transparent glazing transmits direct light. No spectral transmission/refraction model is claimed.
    glass.forEach(({ mesh }) => (mesh.castShadow = false));
    scene.environmentIntensity = day ? 0.06 : 0.001;
    scene.background = new THREE.Color(day ? "#b8d4e4" : "#060c19");
    scene.fog = null;
    renderer.toneMappingExposure = settings.exposure;
    sky.intensity = day ? 0.22 : 0.025;
    sun.intensity = day
      ? 3 * Math.max(0.06, Math.sin(THREE.MathUtils.degToRad(altitude)))
      : 0;
    sun.visible = day;
    const direction = new THREE.Vector3(
      ...sunDirection(solar!.azimuth, altitude),
    ).transformDirection(transform);
    sun.position.copy(center).addScaledVector(direction, 100);
    if (context)
      context.children.forEach(
        (o) => (o.visible = o.userData.upperFloor || settings.neighbors),
      );
    const active = activeLampIds(
      profile!,
      settings.selectedLampId,
      data.house.rd,
    );
    for (const lamp of profile!.lamps) {
      let source = sources.get(lamp.id);
      if (!source) {
        const lampGroup = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.075, 1, 8),
          new THREE.MeshStandardMaterial({
            color: "#5d686e",
            roughness: 0.65,
            metalness: 0.25,
          }),
        );
        // Self-shadowing of a schematic pole must not occlude its own light source.
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 8, 6),
          new THREE.MeshStandardMaterial(),
        );
        lampGroup.add(pole, bulb);
        const point = new THREE.PointLight(),
          spot = new THREE.SpotLight();
        for (const light of [point, spot]) {
          light.castShadow = true;
          light.shadow.mapSize.set(1024, 1024);
          light.shadow.camera.near = 1;
          light.shadow.camera.far = 60;
          light.shadow.bias = -0.0003;
          light.shadow.normalBias = 0.025;
          light.distance = 60;
          light.decay = 2;
          lampGroup.add(light);
        }
        spot.angle = coneAngle;
        spot.penumbra = 0.2;
        lampGroup.add(spot.target);
        group.add(lampGroup);
        source = { group: lampGroup, pole, bulb, point, spot };
        sources.set(lamp.id, source);
      }
      const pos = new THREE.Vector3(
        lamp.rd[0] - origin[0],
        0,
        -(lamp.rd[1] - origin[1]),
      ).applyMatrix4(transform);
      source.group.position.copy(pos);
      const h = lamp.scenario.height;
      source.pole.position.y = h / 2;
      source.pole.scale.y = h;
      source.bulb.position.y = h;
      source.point.position.y = source.spot.position.y = h;
      source.spot.target.position.set(0, 0, 0);
      const color = kelvinColor(lamp.scenario.kelvin);
      const lit = !day && settings.streetLights && active.includes(lamp.id);
      const selected = lamp.id === settings.selectedLampId;
      const bulbMaterial = source.bulb.material as THREE.MeshStandardMaterial;
      bulbMaterial.color.copy(selected ? new THREE.Color("#f8891e") : color);
      bulbMaterial.emissive.copy(lit ? color : new THREE.Color("#000000"));
      bulbMaterial.emissiveIntensity = lit ? 2 : 0;
      for (const [type, light] of [
        ["point", source.point],
        ["downward", source.spot],
      ] as const) {
        light.visible = lit && lamp.scenario.distribution === type;
        light.color.copy(color);
        light.intensity = lampIntensity(
          lamp.scenario.lumens,
          lamp.scenario.distribution,
        );
      }
    }
    invalidate();
  };
  return {
    update,
    dispose() {
      for (const { light } of baseline)
        if (
          light instanceof THREE.DirectionalLight ||
          light instanceof THREE.PointLight
        )
          light.shadow.dispose();
      sun.shadow.dispose();
      sources.forEach((s) => {
        s.point.shadow.dispose();
        s.spot.shadow.dispose();
      });
      // Geometries/materials are owned by the enclosing viewer's scene traversal.
    },
  };
}

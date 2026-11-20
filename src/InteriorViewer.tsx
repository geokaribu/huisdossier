import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Footprints,
  Map as MapIcon,
  RotateCcw,
  DoorOpen,
} from "lucide-react";
import type {
  Floorplan,
  PlanPoint,
  PlanWall,
  Point,
  HouseData,
  HouseAppearance,
  LightingEnvironment,
  LightingSettings,
} from "./types";
import { createLightingRig } from "./lightingScene";
import {
  canStand,
  insidePolygon,
  moveInside,
  wallSolids,
  openDoorLeaves,
} from "./walkthrough";
import type { DoorState } from "./walkthrough";
import { wallCoatings, loadCoatingTextures } from "./wallCoatings";
import { architectureGeometry } from "./planArchitecture";
import { wallSanitary } from "./sanitary";
import { stairsFixture } from "./stairs";
import {
  glazedDoors,
  pavingTexture,
  wallFinish,
  climbingPlants,
  terraceObject,
} from "./terrace";

interface InteriorApi {
  walk: (enabled: boolean) => void;
  room: (point: PlanPoint, yaw?: number, pitch?: number, fov?: number) => void;
  door: (id: string, open: boolean) => void;
  reset: (top?: boolean) => void;
}

function floorShape(points: PlanPoint[], material: THREE.Material, y = 0) {
  const shape = new THREE.Shape(
    points.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

function floorTexture(tile = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = tile ? "#e0e4df" : "#d5bc96";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 47;
  for (let i = 0; i < 1800; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ctx.fillStyle = i % 2 ? "rgba(90,70,40,.08)" : "rgba(255,255,255,.14)";
    ctx.fillRect(seed % 256, (seed >>> 8) % 256, tile ? 1 : 1 + (seed % 37), 1);
  }
  ctx.strokeStyle = tile ? "#bcc5bf" : "#b79b77";
  ctx.lineWidth = 1;
  for (let i = 0; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }
  for (let i = 0; i < 256; i += tile ? 64 : 128) {
    for (let j = 0; j < 4; j++) {
      const y = i + (tile ? 0 : (j % 2) * 64);
      ctx.beginPath();
      ctx.moveTo(j * 64, y);
      ctx.lineTo((j + 1) * 64, y);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(tile ? 1.2 : 0.8, tile ? 1.2 : 0.8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function tileFinish(size: number, color: string, groutColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  let seed = 81;
  for (let i = 0; i < 3000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.035)";
    ctx.fillRect(seed % 256, (seed >>> 8) % 256, 1, 1);
  }
  ctx.strokeStyle = groutColor;
  ctx.lineWidth = Math.max(1, (256 * 0.003) / size);
  ctx.strokeRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / size, 1 / size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function InteriorViewer({
  data,
  appearance,
  lighting,
  lightSettings,
  plan,
  initialRoomId,
  onDossier,
  dossierRooms = [],
}: {
  data: HouseData;
  appearance: HouseAppearance | null;
  lighting: LightingEnvironment | null;
  lightSettings: LightingSettings;
  plan: Floorplan;
  initialRoomId?: string;
  onDossier?: (roomId: string) => void;
  dossierRooms?: string[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<InteriorApi | null>(null);
  const updateLighting = useRef<(() => void) | null>(null);
  const lightState = useRef({ lighting, lightSettings });
  lightState.current = { lighting, lightSettings };
  const movement = useRef(new Set<string>());
  const sceneState = useRef<{
    position: PlanPoint;
    walking: boolean;
    yaw: number;
    pitch: number;
    fov: number;
    doors: DoorState;
    camera: Point;
    target: Point;
  } | null>(null);
  const [walking, setWalking] = useState(false);
  const [position, setPosition] = useState<PlanPoint>(plan.spawn);
  const [failed, setFailed] = useState(false);
  const joinery = plan.walls.flatMap((w) =>
    w.openings.flatMap((o) => (o.joinery ? [o.joinery] : [])),
  );
  const [doors, setDoors] = useState<DoorState>(() =>
    Object.fromEntries(joinery.map((j) => [j.id, j.defaultOpen])),
  );
  const [doorNotice, setDoorNotice] = useState("");
  const activeRoom = plan.rooms.find((room) =>
    insidePolygon(position, room.polygon),
  );
  const bounds = plan.outline.reduce(
    (b, p) => [
      Math.min(b[0], p[0]),
      Math.min(b[1], p[1]),
      Math.max(b[2], p[0]),
      Math.max(b[3], p[1]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor("#eee9de");
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "3D-interieur. Kies Rondlopen, gebruik W A S D of de pijltjestoetsen en sleep om rond te kijken. Escape stopt het rondlopen.",
    );
    container.appendChild(canvas);
    const scene = new THREE.Scene();
    // Neutral studio reflections make chrome/ceramic readable; this is illustrative lighting.
    const environmentScene = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(environmentScene, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.35;
    environmentScene.dispose();
    pmrem.dispose();
    scene.background = new THREE.Color("#eee9de");
    scene.add(new THREE.HemisphereLight("#fffdf4", "#b5b6aa", 1.35));
    const sun = new THREE.DirectionalLight("#fff3d9", 2);
    sun.position.set(-5, 14, -9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -10,
      right: 10,
      top: 10,
      bottom: -10,
      near: 0.1,
      far: 45,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
    const modelCenter = new THREE.Vector3(
      (bounds[0] + bounds[2]) / 2,
      0,
      (bounds[1] + bounds[3]) / 2,
    );
    sun.position.add(modelCenter);
    sun.target.position.copy(modelCenter);
    scene.add(sun.target);
    scene.add(sun);
    for (const room of plan.rooms.filter((r) => !r.outside)) {
      const light = new THREE.PointLight("#fff9ee", 2.2, 4, 2);
      light.position.set(room.center[0], 2.35, room.center[1]);
      scene.add(light);
    }
    const camera = new THREE.PerspectiveCamera(58, 1, 0.045, 100);
    camera.rotation.order = "YXZ";
    const controls = new OrbitControls(camera, canvas);
    let dirty = true;
    const invalidate = () => {
      dirty = true;
    };
    controls.addEventListener("change", invalidate);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2;
    controls.maxDistance = 40;
    const wood = floorTexture(),
      tile = floorTexture(true);
    const privateTextures: THREE.Texture[] = [];
    const paintMaps = loadCoatingTextures(plan, invalidate);
    privateTextures.push(...paintMaps.values());
    let doorState: DoorState = Object.fromEntries(
      plan.walls.flatMap((w) =>
        w.openings.flatMap((o) =>
          o.joinery
            ? [
                [
                  o.joinery.id,
                  sceneState.current?.doors[o.joinery.id] ??
                    o.joinery.defaultOpen,
                ],
              ]
            : [],
        ),
      ),
    );
    setDoors({ ...doorState });
    const doorModels = new Map<string, ReturnType<typeof glazedDoors>>();
    const plaster = new THREE.MeshStandardMaterial({
      color: "#f4f0e7",
      roughness: 0.92,
    });
    const cut = new THREE.MeshStandardMaterial({
      color: "#c8c5b8",
      roughness: 1,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: "#f4f2ec",
      roughness: 0.7,
    });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: "#526371",
      roughness: 0.55,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#a8c5cf",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      roughness: 0.16,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    const counter = new THREE.MeshStandardMaterial({
      color: "#deded0",
      roughness: 0.6,
    });
    const cabinet = new THREE.MeshStandardMaterial({
      color: "#c4c6b5",
      roughness: 0.7,
    });
    const porcelain = new THREE.MeshStandardMaterial({
      color: "#fafcf8",
      roughness: 0.25,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#2f3c41",
      roughness: 0.3,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: "#a9b4b5",
      metalness: 0.6,
      roughness: 0.3,
    });
    function box(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      angle = 0,
    ) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }
    const slab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(
        new THREE.Shape(plan.outline.map(([x, z]) => new THREE.Vector2(x, -z))),
        { depth: 0.12, bevelEnabled: false },
      ),
      new THREE.MeshStandardMaterial({ color: "#c4c1b3", roughness: 1 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = -0.12;
    slab.receiveShadow = true;
    scene.add(slab);
    // Continuous subfloor closes tracing margins and thresholds under individual room finishes.
    scene.add(
      floorShape(
        plan.ceiling,
        new THREE.MeshStandardMaterial({
          color:
            plan.rooms.find((r) => !r.outside && r.floorColor)?.floorColor ??
            "#e8e5de",
          roughness: 0.9,
        }),
        0,
      ),
    );
    for (const room of plan.rooms) {
      const tiled = room.floor === "tile" || room.outside || room.shared;
      const mat = new THREE.MeshStandardMaterial({
        color:
          (room.floorTiling ? "#ffffff" : room.floorColor) ??
          (room.paving
            ? "#ffffff"
            : room.outside
              ? "#b4b6ac"
              : room.shared
                ? "#c5c8c4"
                : tiled
                  ? "#d9e2df"
                  : "#ffffff"),
        map: room.floorTiling
          ? (() => {
              const map = tileFinish(
                room.floorTiling.size,
                room.floorColor ?? "#777777",
                room.floorTiling.groutColor,
              );
              privateTextures.push(map);
              return map;
            })()
          : room.floorColor
            ? null
            : room.paving
              ? (() => {
                  const map = pavingTexture(
                    room.paving.size,
                    room.paving.color,
                  );
                  privateTextures.push(map);
                  return map;
                })()
              : tiled
                ? tile
                : wood,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      scene.add(floorShape(room.polygon, mat, 0.002));
    }
    const finishes = new Map<PlanWall, THREE.Material>();
    for (const [index, wall] of plan.walls.entries()) {
      if (wall.finish) {
        const map = wallFinish(wall.finish.texture);
        privateTextures.push(map);
        finishes.set(
          wall,
          new THREE.MeshStandardMaterial({
            color: wall.finish.color,
            map,
            roughness: 0.95,
          }),
        );
      }
      if (wall.climber) scene.add(climbingPlants(wall, index));
    }
    for (const item of plan.decorations ?? []) scene.add(terraceObject(item));
    const wallGroups = new Map<THREE.Material, PlanWall[]>();
    for (const wall of plan.walls) {
      const mat = finishes.get(wall) ?? plaster;
      wallGroups.set(mat, [...(wallGroups.get(mat) ?? []), wall]);
    }
    for (const [mat, walls] of wallGroups) {
      const mesh = new THREE.Mesh(
        architectureGeometry(walls, plan.ceilingHeight),
        [mat, cut],
      );
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    }
    const skirting = new THREE.Mesh(
      architectureGeometry(
        plan.walls.filter((w) => !w.outsideRoomId),
        plan.ceilingHeight,
        true,
      ),
      trim,
    );
    skirting.castShadow = skirting.receiveShadow = true;
    scene.add(skirting);
    function wallPiece(
      wall: PlanWall,
      from: number,
      to: number,
      bottom: number,
      top: number,
    ) {
      if (to - from < 0.005 || top - bottom < 0.005) return;
      if (wall.coatings?.length)
        scene.add(wallCoatings(wall, from, to, bottom, top, paintMaps));
    }
    for (const wall of plan.walls) {
      const dx = wall.b[0] - wall.a[0],
        dz = wall.b[1] - wall.a[1],
        length = Math.hypot(dx, dz),
        height = wall.height ?? plan.ceilingHeight;
      let end = 0;
      for (const opening of [...wall.openings].sort(
        (a, b) => a.offset - b.offset,
      )) {
        wallPiece(wall, end, opening.offset, 0, height);
        wallPiece(
          wall,
          opening.offset,
          opening.offset + opening.width,
          0,
          opening.sill,
        );
        wallPiece(
          wall,
          opening.offset,
          opening.offset + opening.width,
          opening.sill + opening.height,
          height,
        );
        if (opening.joinery) {
          const model = glazedDoors(wall, opening, opening.joinery);
          model.setOpen(doorState[opening.joinery.id]);
          doorModels.set(opening.joinery.id, model);
          scene.add(model.group);
          end = opening.offset + opening.width;
          continue;
        }
        const ang = -Math.atan2(dz, dx);
        const openingFrame = opening.frameColor
          ? new THREE.MeshStandardMaterial({
              color: opening.frameColor,
              roughness: 0.55,
            })
          : frameMaterial;
        const at = (
          offset: number,
          y: number,
          w: number,
          h: number,
          mat: THREE.Material,
        ) =>
          box(
            wall.a[0] + (dx * offset) / length,
            y,
            wall.a[1] + (dz * offset) / length,
            w,
            h,
            wall.thickness + 0.035,
            mat,
            ang,
          );
        for (const t of [opening.offset, opening.offset + opening.width])
          at(
            t,
            opening.sill + opening.height / 2,
            0.045,
            opening.height,
            openingFrame,
          );
        at(
          opening.offset + opening.width / 2,
          opening.sill + opening.height,
          opening.width,
          0.045,
          openingFrame,
        );
        if (opening.kind === "window") {
          at(
            opening.offset + opening.width / 2,
            opening.sill,
            opening.width,
            0.045,
            openingFrame,
          );
          at(
            opening.offset + opening.width / 2,
            opening.sill + opening.height / 2,
            opening.width,
            opening.height,
            glass,
          );
          at(
            opening.offset + opening.width / 2,
            opening.sill + opening.height * 0.78,
            opening.width,
            0.035,
            openingFrame,
          );
        }
        end = opening.offset + opening.width;
      }
      wallPiece(wall, end, length, 0, height);
    }
    for (const f of plan.fixtures) {
      if (
        f.mounting === "wall" &&
        (f.kind === "toilet" || f.kind === "basin" || f.kind === "sink")
      ) {
        scene.add(wallSanitary(f));
        continue;
      }
      const [x, z] = f.center,
        [w, d] = f.size,
        h = f.height;
      if (f.kind === "counter" || f.kind === "closet") {
        box(x, h / 2, z, w, h, d, cabinet);
        box(x, h, z, w + 0.025, 0.035, d + 0.025, counter);
        const n = Math.max(1, Math.round(d / 0.5));
        for (let i = 0; i < n; i++) {
          box(
            x + w / 2 + 0.007,
            h * 0.5,
            z - d / 2 + ((i + 0.5) * d) / n,
            0.015,
            h - 0.07,
            d / n - 0.025,
            trim,
          );
          box(
            x + w / 2 + 0.02,
            h * 0.64,
            z - d / 2 + ((i + 0.5) * d) / n,
            0.018,
            0.1,
            0.018,
            metal,
          );
        }
      } else if (f.kind === "stairs") {
        scene.add(stairsFixture(f, trim));
      } else if (f.kind === "sink" || f.kind === "basin") {
        box(x, h - 0.04, z, w, 0.08, d, porcelain);
        box(x, h + 0.005, z, w * 0.72, 0.02, d * 0.65, metal);
        box(x, h + 0.12, z - d * 0.38, 0.025, 0.22, 0.025, metal);
        box(x, h + 0.22, z - d * 0.25, 0.025, 0.025, d * 0.3, metal);
      } else if (f.kind === "hob") {
        box(x, h, z, w, 0.025, d, dark);
        for (const a of [-1, 1])
          for (const b of [-1, 1]) {
            const burner = new THREE.Mesh(
              new THREE.TorusGeometry(w * 0.15, 0.012, 6, 24),
              metal,
            );
            burner.rotation.x = Math.PI / 2;
            burner.position.set(x + a * w * 0.24, h + 0.02, z + b * d * 0.25);
            scene.add(burner);
          }
      } else if (f.kind === "toilet") {
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.45, w * 0.3, h * 0.7, 24),
          porcelain,
        );
        bowl.position.set(x, h * 0.4, z);
        scene.add(bowl);
        box(x, h * 0.7, z - d * 0.32, w * 0.85, h * 0.8, d * 0.23, porcelain);
        const seat = new THREE.Mesh(
          new THREE.TorusGeometry(w * 0.32, 0.035, 8, 28),
          trim,
        );
        seat.rotation.x = Math.PI / 2;
        seat.scale.y = 1.35;
        seat.position.set(x, h * 0.8, z);
        scene.add(seat);
      } else if (f.kind === "shower") {
        box(x, 0.025, z, w, 0.05, d, porcelain);
        box(x + w / 2 - 0.025, 0.95, z, 0.018, 1.8, d, glass);
        box(x, 0.95, z - d / 2, 0.025, 1.8, 0.025, metal);
      }
    }
    const ceiling = floorShape(
      plan.ceiling,
      new THREE.MeshStandardMaterial({
        color: "#faf7ee",
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      plan.ceilingHeight,
    );
    ceiling.visible = false;
    ceiling.castShadow = true;
    scene.add(ceiling);
    const center = new THREE.Vector3(
      (bounds[0] + bounds[2]) / 2,
      0,
      (bounds[1] + bounds[3]) / 2,
    );
    let walk = false,
      p: PlanPoint = [...plan.spawn],
      yaw = 0,
      pitch = 0,
      dragged = false;
    const rig = appearance?.rear
      ? createLightingRig(scene, renderer, data, invalidate, {
          appearance,
          plan,
        })
      : null;
    updateLighting.current = () => {
      const state = lightState.current;
      rig?.update(state.lighting, state.lightSettings);
      const simulate = Boolean(
        rig && state.lighting && state.lightSettings.enabled,
      );
      if (!simulate)
        scene.background = new THREE.Color(walk ? "#c8dfea" : "#eee9de");
      ceiling.visible = walk || simulate;
      // In the dollhouse view, hide the ceiling from the camera while retaining its shadow.
      const mat = ceiling.material as THREE.MeshStandardMaterial;
      mat.colorWrite = mat.depthWrite = walk;
      dirty = true;
    };
    const frame = (top = false) => {
      camera.fov = 58;
      camera.updateProjectionMatrix();
      dirty = true;
      controls.target.copy(center);
      controls.target.y = 0.2;
      const length = bounds[3] - bounds[1];
      camera.position
        .copy(center)
        .add(
          top
            ? new THREE.Vector3(0, length * 1.25, 0.001)
            : new THREE.Vector3(length * 0.43, length * 0.9, length * 0.55),
        );
      camera.lookAt(controls.target);
      controls.update();
    };
    const look = () => {
      dirty = true;
      camera.position.set(p[0], 1.62, p[1]);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    };
    const setWalk = (enabled: boolean) => {
      movement.current.clear();
      walk = enabled;
      controls.enabled = !enabled;
      ceiling.visible = enabled;
      scene.background = new THREE.Color(enabled ? "#c8dfea" : "#eee9de");
      updateLighting.current?.();
      canvas.classList.toggle("walking", enabled);
      setWalking(enabled);
      if (enabled) {
        look();
        canvas.focus({ preventScroll: true });
      } else frame();
    };
    api.current = {
      walk: setWalk,
      reset: (top) => {
        setWalk(false);
        p = [...plan.spawn];
        setPosition([...p]);
        yaw = pitch = 0;
        frame(top);
      },
      room: (point, viewYaw = 0, viewPitch = 0, viewFov = 58) => {
        if (!canStand(plan, point, 0.16, doorState)) return;
        p = [...point];
        yaw = viewYaw;
        pitch = viewPitch;
        camera.fov = viewFov;
        camera.updateProjectionMatrix();
        setPosition([...p]);
        setWalk(true);
      },
      door: (id, open) => {
        const next = { ...doorState, [id]: open };
        if (walk && !canStand(plan, p, 0.16, next)) {
          setDoorNotice("Zet eerst een stap bij de deur vandaan.");
          return;
        }
        doorState = next;
        doorModels.get(id)?.setOpen(open);
        renderer.shadowMap.needsUpdate = true;
        setDoors({ ...doorState });
        setDoorNotice("");
        dirty = true;
      },
    };
    frame();
    const saved = sceneState.current;
    const initial = plan.rooms.find((r) => r.id === initialRoomId);
    if (saved) {
      const safePoint = canStand(plan, saved.position, 0.16, doorState)
        ? saved.position
        : (plan.rooms.find(
            (r) =>
              insidePolygon(saved.position, r.polygon) &&
              canStand(plan, r.center, 0.16, doorState),
          )?.center ?? plan.spawn);
      p = [...safePoint];
      yaw = saved.yaw;
      pitch = saved.pitch;
      camera.fov = saved.fov;
      camera.updateProjectionMatrix();
      setPosition([...p]);
      setWalk(saved.walking);
      if (!saved.walking) {
        camera.position.fromArray(saved.camera);
        controls.target.fromArray(saved.target);
        controls.update();
      }
    } else if (initial)
      api.current.room(
        initial.center,
        initial.viewYaw,
        initial.viewPitch,
        initial.viewFov,
      );
    const keys = movement.current;
    const keydown = (e: KeyboardEvent) => {
      if (
        !walk ||
        (e.target instanceof HTMLElement &&
          /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))
      )
        return;
      if (e.key === "Escape") {
        setWalk(false);
        return;
      }
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
        keys.add(e.code);
      }
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.code);
    const clear = () => {
      keys.clear();
      dragged = false;
    };
    let lastX = 0,
      lastY = 0;
    const down = (e: PointerEvent) => {
      if (!walk) return;
      dragged = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!walk || !dragged) return;
      yaw -= (e.clientX - lastX) * 0.004;
      pitch = Math.max(
        -1.25,
        Math.min(1.25, pitch - (e.clientY - lastY) * 0.004),
      );
      lastX = e.clientX;
      lastY = e.clientY;
      look();
    };
    const up = () => {
      dragged = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    const resize = new ResizeObserver(() => {
      dirty = true;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resize.observe(container);
    let frameId = 0,
      last = performance.now(),
      lastReport = 0;
    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.06);
      last = now;
      if (document.hidden) return;
      if (walk) {
        let forward =
          Number(keys.has("KeyW") || keys.has("ArrowUp")) -
          Number(keys.has("KeyS") || keys.has("ArrowDown"));
        let side =
          Number(keys.has("KeyD") || keys.has("ArrowRight")) -
          Number(keys.has("KeyA") || keys.has("ArrowLeft"));
        const norm = Math.hypot(forward, side) || 1;
        forward /= norm;
        side /= norm;
        if (forward || side) {
          p = moveInside(
            plan,
            p,
            [
              (side * Math.cos(yaw) - forward * Math.sin(yaw)) * dt * 1.65,
              (-forward * Math.cos(yaw) - side * Math.sin(yaw)) * dt * 1.65,
            ],
            doorState,
          );
          look();
          if (now - lastReport > 80) {
            setPosition([...p]);
            lastReport = now;
          }
        }
      } else controls.update();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    frameId = requestAnimationFrame(tick);
    updateLighting.current();
    return () => {
      sceneState.current = {
        position: [...p],
        walking: walk,
        yaw,
        pitch,
        fov: camera.fov,
        doors: { ...doorState },
        camera: camera.position.toArray() as Point,
        target: controls.target.toArray() as Point,
      };
      cancelAnimationFrame(frameId);
      resize.disconnect();
      keys.clear();
      api.current = null;
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      controls.dispose();
      rig?.dispose();
      updateLighting.current = null;
      controls.removeEventListener("change", invalidate);
      const materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const mat of Array.isArray(o.material)
            ? o.material
            : [o.material])
            materials.add(mat);
        }
      });
      materials.forEach((m) => m.dispose());
      wood.dispose();
      tile.dispose();
      privateTextures.forEach((t) => t.dispose());
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    };
    // A house change remounts the viewer; the scene is entirely profile-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, data, appearance]);
  useEffect(() => {
    updateLighting.current?.();
  }, [lighting, lightSettings]);

  const pad = (key: string, label: string, Icon: typeof ArrowUp) => (
    <button
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        movement.current.add(key);
      }}
      onPointerUp={() => movement.current.delete(key)}
      onPointerCancel={() => movement.current.delete(key)}
      onLostPointerCapture={() => movement.current.delete(key)}
    >
      <Icon size={20} />
    </button>
  );
  return (
    <div className="interior-layout">
      <section className="interior-scene" aria-label="Interieur bekijken">
        <div className="interior-toolbar">
          <div className="interior-modes">
            <button
              className={!walking ? "active" : ""}
              aria-pressed={!walking}
              onClick={() => api.current?.walk(false)}
            >
              <Box size={16} /> Overzicht
            </button>
            <button
              className={walking ? "active" : ""}
              aria-pressed={walking}
              onClick={() => api.current?.walk(true)}
            >
              <Footprints size={16} /> Rondlopen
            </button>
          </div>
          <button
            className="icon-button"
            title="Bovenaanzicht"
            aria-label="Plattegrond van boven"
            onClick={() => api.current?.reset(true)}
          >
            <MapIcon size={18} />
          </button>
          <button
            className="icon-button"
            title="Herstel beginpositie"
            aria-label="Herstel beginpositie"
            onClick={() => api.current?.reset()}
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <div ref={host} className="interior-canvas" />
        {joinery.length > 0 && (
          <div className="interior-door-controls">
            {joinery.map((j) => (
              <button
                key={j.id}
                aria-pressed={doors[j.id] ?? j.defaultOpen}
                onClick={() =>
                  api.current?.door(j.id, !(doors[j.id] ?? j.defaultOpen))
                }
              >
                <DoorOpen size={16} />
                {j.label}{" "}
                {(doors[j.id] ?? j.defaultOpen) ? "sluiten" : "openen"}
              </button>
            ))}
            {doorNotice && <span role="status">{doorNotice}</span>}
          </div>
        )}
        {failed && (
          <div className="interior-failed" role="alert">
            3D kan niet starten. Schakel hardwareversnelling in je browser in en
            herlaad de pagina.
          </div>
        )}
        <div
          className="interior-status"
          data-position={position.map((n) => n.toFixed(3)).join(",")}
        >
          <span className="status-dot" />
          {walking
            ? (activeRoom?.name ?? "Doorgang")
            : "Begane grond · open overzicht"}
        </div>
        <div className="interior-hint">
          {walking
            ? "W A S D / pijltjes = lopen · slepen = kijken · Esc = overzicht"
            : "Sleep om te draaien · scroll om te zoomen · kies een kamer om binnen te kijken"}
        </div>
        {walking && (
          <div className="walk-pad" aria-label="Loopbediening">
            <span />
            {pad("KeyW", "Loop vooruit", ArrowUp)}
            <span />
            {pad("KeyA", "Loop naar links", ArrowLeft)}
            {pad("KeyS", "Loop achteruit", ArrowDown)}
            {pad("KeyD", "Loop naar rechts", ArrowRight)}
          </div>
        )}
      </section>
      <aside className="interior-sidebar">
        <div className="interior-intro">
          <span className="eyebrow">BINNEN KIJKEN</span>
          <h2>Je huis, van binnen</h2>
          <p>
            Kies een ruimte en loop door je huis. De openingen verbinden de
            kamers met de hal.
          </p>
        </div>
        <svg
          className="interior-map"
          viewBox={`${bounds[0] - 0.25} ${bounds[1] - 0.25} ${bounds[2] - bounds[0] + 0.5} ${bounds[3] - bounds[1] + 0.5}`}
          role="img"
          aria-label="Plattegrond met je huidige positie"
        >
          {plan.rooms.map((room) => (
            <polygon
              key={room.id}
              points={room.polygon.map((p) => p.join(",")).join(" ")}
              fill={room.color}
              stroke="#fdfcf9"
              strokeWidth=".06"
            />
          ))}
          {plan.walls.map((wall, i) => {
            const dx = wall.b[0] - wall.a[0],
              dz = wall.b[1] - wall.a[1],
              length = Math.hypot(dx, dz);
            return (
              <g key={i}>
                {wallSolids(wall, doors).map(([a, b], n) => (
                  <line
                    key={n}
                    x1={wall.a[0] + (dx * a) / length}
                    y1={wall.a[1] + (dz * a) / length}
                    x2={wall.a[0] + (dx * b) / length}
                    y2={wall.a[1] + (dz * b) / length}
                    stroke="#37434b"
                    strokeWidth=".055"
                  />
                ))}
                {openDoorLeaves(wall, doors).map(([a, b], n) => (
                  <line
                    key={`leaf-${n}`}
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                    stroke="#526371"
                    strokeWidth=".045"
                  />
                ))}
              </g>
            );
          })}
          <circle
            cx={position[0]}
            cy={position[1]}
            r=".19"
            fill="#F8891E"
            stroke="white"
            strokeWidth=".06"
          />
        </svg>
        <div className="interior-rooms">
          {plan.rooms.map((room) => (
            <div className="interior-room-row" key={room.id}>
              <button
                key={room.id}
                className={
                  walking && activeRoom?.id === room.id ? "active" : ""
                }
                onClick={() =>
                  api.current?.room(
                    room.center,
                    room.viewYaw,
                    room.viewPitch,
                    room.viewFov,
                  )
                }
              >
                <span>
                  <span
                    className="room-swatch"
                    style={{ background: room.color }}
                  />
                  {room.name}
                </span>
                <small>
                  {room.area
                    ? `${room.area.toLocaleString("nl-NL")} m²`
                    : room.shared
                      ? "gedeeld"
                      : room.outside
                        ? "buiten"
                        : ""}
                  <ArrowRight size={14} />
                </small>
              </button>
              {dossierRooms.includes(room.id) && (
                <button
                  className="room-dossier-button"
                  aria-label={`Open dossier ${room.name}`}
                  onClick={() => onDossier?.(room.id)}
                >
                  Dossier →
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="interior-provenance">
          <strong>Bronnen en maten</strong>
          <p>
            3,70 m tuinbreedte · 2,64 m plafond in de woonkamer. Eén woonlaag;
            verdere maten en afwerking zijn benaderd.
          </p>
          <details>
            <summary>Bron & aannames</summary>
            <p>{plan.source}</p>
            <p>{plan.description}</p>
          </details>
        </div>
      </aside>
    </div>
  );
}

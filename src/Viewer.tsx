import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Focus,
  Minus,
  Plus,
  Camera,
  RotateCcw,
  Box,
  Scan,
  MapPin,
  Footprints,
} from "lucide-react";
import { triangulateSurface } from "./geometry";
import { createLightingRig, contextBuildings } from "./lightingScene";
import type { LightingRig } from "./lightingScene";
import { exteriorShell } from "./exteriorShell";
import { contextCutaway } from "./contextCutaway";
import {
  spatialAsset,
  visibleSpatialHit,
  SpatialTap,
  selectionOutline,
} from "./spatialSelection";
import type {
  HouseData,
  Asset,
  Point,
  HouseAppearance,
  Floorplan,
  LightingEnvironment,
  LightingSettings,
} from "./types";
import {
  frontRelief,
  flatRoofDetails,
  rearExterior,
  planToExterior,
} from "./houseEnvelope";
import {
  facadeDetails,
  frontFrame,
  isFrontSurface,
  materialTextures,
  projectFront,
  projectAerial,
  projectMaterial,
} from "./appearance";

interface Props {
  lighting: LightingEnvironment | null;
  lightSettings: LightingSettings;
  onNeighbors: (enabled: boolean) => void;
  data: HouseData;
  appearance: HouseAppearance | null;
  floorplan: Floorplan | null;
  onInterior: () => void;
  assets: Asset[];
  selected: Asset | undefined;
  onSelect: (id: string) => void;
  placing: boolean;
  onPlace: (point: Point) => void;
  onError: (message: string) => void;
}
type ExteriorView = "overview" | "front" | "rear" | "roof" | "top";
interface ViewerApi {
  frame: (top?: boolean, front?: boolean, roof?: boolean) => void;
  zoom: (factor: number) => void;
  photo: () => void;
  view: (side: ExteriorView) => void;
  update: (
    context: boolean,
    wire: boolean,
    selected: Asset | undefined,
    assets: Asset[],
    styled: boolean,
  ) => void;
}

export function Viewer({
  lighting,
  lightSettings,
  onNeighbors,
  data,
  appearance,
  floorplan,
  onInterior,
  assets,
  selected,
  onSelect,
  placing,
  onPlace,
  onError,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const north = useRef<HTMLDivElement>(null);
  const api = useRef<ViewerApi | null>(null);
  const sceneView = useRef<{ camera: number[]; target: number[] } | null>(null);
  const callbacks = useRef({ onSelect, onPlace, placing, assets });
  callbacks.current = { onSelect, onPlace, placing, assets };
  const [hovered, setHovered] = useState("");
  const context = lightSettings.neighbors;
  const rig = useRef<LightingRig | null>(null);
  const lightState = useRef({ lighting, lightSettings });
  lightState.current = { lighting, lightSettings };
  const [wire, setWire] = useState(false);
  const [top, setTop] = useState(false);
  const [failed, setFailed] = useState(false);
  const [styled, setStyled] = useState(true);
  const [view, setView] = useState<ExteriorView>("overview");
  const [cutaway, setCutaway] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#F6F2E7");
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute(
      "aria-label",
      `Interactief 3D-model van ${data.house.address}. Gebruik de knoppen voor bovenaanzicht en zoomen; kies onderdelen in de lijst.`,
    );
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#F6F2E7", 65, 140);
    scene.add(new THREE.HemisphereLight("#ffffff", "#9c907c", 1.4));
    const sun = new THREE.DirectionalLight("#fff7e8", 1.8);
    sun.position.set(-15, 40, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 1,
      far: 120,
    });
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.015;
    scene.add(sun);
    const target = data.buildings.find((b) => b.target)!;
    const targetPoints = target.surfaces.flatMap((s) => s.rings.flat());
    const origin: Point = [
      data.house.rd[0],
      data.house.rd[1],
      Math.min(...targetPoints.map((p) => p[2])),
    ];
    const buildings = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const targetEdges: THREE.LineSegments[] = [];
    let invalidate = () => {};
    const textures = appearance ? materialTextures() : null;
    const facadeMap = appearance
      ? new THREE.TextureLoader().load(
          appearance.front.texture,
          () => invalidate(),
          undefined,
          () =>
            onError(
              "Het gevelbeeld kon niet worden geladen. De oorspronkelijke gebouwvorm blijft beschikbaar.",
            ),
        )
      : null;
    if (facadeMap) {
      facadeMap.userData.bakedLighting = true;
      facadeMap.colorSpace = THREE.SRGBColorSpace;
      facadeMap.anisotropy = 8;
    }
    const aerialMap = appearance?.aerial
      ? new THREE.TextureLoader().load(
          appearance.aerial.texture,
          () => invalidate(),
          undefined,
          () => onError("De luchtfoto kon niet worden geladen."),
        )
      : null;
    if (aerialMap) {
      aerialMap.userData.bakedLighting = true;
      aerialMap.colorSpace = THREE.SRGBColorSpace;
      aerialMap.anisotropy = 8;
    }
    const targetBox = new THREE.Box3();
    for (const building of data.buildings) {
      if (!building.target) continue;
      const group = new THREE.Group();
      group.userData.isTarget = building.target;
      for (const [surfaceIndex, surface] of building.surfaces.entries()) {
        const geometry = triangulateSurface(surface, origin);
        if (!geometry) continue;
        const roof = surface.type === "RoofSurface";
        const color = building.target
          ? roof
            ? "#a45b36"
            : "#edaa62"
          : roof
            ? "#b9bbae"
            : "#d7d5c9";
        const front = Boolean(
          building.target && appearance && isFrontSurface(surface, appearance),
        );
        const styleMap =
          building.target && textures
            ? front
              ? facadeMap
              : roof
                ? (aerialMap ?? textures.roofMap)
                : textures.stuccoMap
            : null;
        if (building.target && appearance) {
          if (front) projectFront(geometry, appearance, origin);
          else if (roof && appearance.aerial)
            projectAerial(geometry, appearance.aerial, origin);
          else projectMaterial(geometry, appearance, origin, roof);
        }
        const styleColor = building.target && appearance ? "#ffffff" : color;
        const styleClip =
          front && appearance
            ? [
                new THREE.Plane(
                  new THREE.Vector3(0, -1, 0),
                  appearance.front.top - origin[2],
                ),
              ]
            : null;
        const material = new THREE.MeshStandardMaterial({
          color: styleColor,
          map: styleMap,
          roughness: roof && appearance ? 0.73 : 0.95,
          metalness: roof && appearance ? 0.12 : 0,
          side: THREE.DoubleSide,
          flatShading: true,
          clippingPlanes: styleClip,
          clipShadows: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          isTarget: building.target,
          surfaceType: surface.type,
          baseColor: color,
          buildingId: building.id,
          styleMap,
          styleColor,
          surfaceIndex,
          styleClip,
        };
        group.add(mesh);
        meshes.push(mesh);
        if (building.target) targetBox.expandByObject(mesh);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 25),
          new THREE.LineBasicMaterial({
            color: building.target ? "#885333" : "#a7ad9e",
            transparent: true,
            opacity: building.target ? 0.5 : 0.28,
          }),
        );
        group.add(edges);
        if (building.target) {
          targetEdges.push(edges);
          edges.visible = !appearance;
        }
      }
      buildings.add(group);
    }
    scene.add(buildings);
    const neighbors = contextBuildings(data, origin);
    neighbors.userData.isTarget = false;
    buildings.add(neighbors);
    const details = appearance
      ? facadeDetails(appearance, origin, target.surfaces, textures?.roofMap)
      : new THREE.Group();
    if (appearance?.frontOpenings?.length)
      details.add(
        frontRelief(appearance, origin, facadeMap, textures?.stuccoMap ?? null),
      );
    if (appearance?.flatRoof)
      details.add(flatRoofDetails(appearance, origin, target.surfaces));
    const shellDetails = appearance?.shell
      ? exteriorShell(
          appearance,
          origin,
          target.surfaces,
          textures?.stuccoMap ?? null,
          aerialMap,
        )
      : null;
    if (shellDetails) details.add(shellDetails);
    const rear =
      appearance?.rear && floorplan
        ? rearExterior(
            appearance,
            origin,
            floorplan,
            true,
            () => invalidate(),
            target.surfaces,
          )
        : null;
    if (rear) details.add(rear.group);
    scene.add(details);
    targetBox.expandByObject(details);
    const detailMeshes: THREE.Mesh[] = [];
    details.traverse((o) => {
      if (o instanceof THREE.Mesh) detailMeshes.push(o);
    });
    let outline = new THREE.Group();
    scene.add(outline);
    const clearOutline = () => {
      scene.remove(outline);
      outline.traverse((object) => {
        if (object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
    };
    const revealHouse = contextCutaway(neighbors, () => [
      ...meshes.filter((m) => m.visible),
      ...(details.visible ? detailMeshes : []),
    ]);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(250, 250),
      new THREE.MeshStandardMaterial({ color: "#eee9dc", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(140, 70, "#c5c6b4", "#dfddce");
    grid.position.y = -0.05;
    scene.add(grid);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(14.5, 14.55, 100),
      new THREE.MeshBasicMaterial({ color: "#b8b9aa", side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.04;
    ring.visible = false;
    grid.visible = false;
    scene.add(ring);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.minDistance = 6;
    controls.maxDistance = 125;
    const center = targetBox.getCenter(new THREE.Vector3());
    const size = targetBox.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, size.y, 10);
    // Larger footprints require a more distant camera, particularly on narrow screens.
    // Keep the target outside the context fog instead of washing out its own geometry.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = Math.max(65, span * 4);
      scene.fog.far = Math.max(140, span * 7);
    }
    const frame = (fromTop = false, fromFront = false, fromRoof = false) => {
      controls.target.copy(center).y = fromTop ? 0 : size.y * 0.36;
      const distance = span * (container.clientWidth < 500 ? 2.7 : 1.7);
      if (fromTop) {
        const aspect = container.clientWidth / container.clientHeight,
          tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const fit =
          Math.max(size.x / (2 * tan * aspect), size.z / (2 * tan)) * 1.18 +
          size.y / 2;
        controls.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(0, fit, 0.001));
        controls.update();
        return;
      }
      if (appearance && !fromTop) {
        const { u, normal, width } = frontFrame(appearance);
        if (fromRoof && appearance.roof) {
          const rise = appearance.roof.top - appearance.front.top;
          const aspect = container.clientWidth / container.clientHeight;
          const distance =
            Math.max(
              width /
                (2 *
                  Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
                  aspect),
              rise / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
            ) * 1.4;
          controls.target.set(
            appearance.front.left[0] + (u[0] * width) / 2 - origin[0],
            appearance.front.top + rise * 0.5 - origin[2],
            -(appearance.front.left[1] + (u[1] * width) / 2 - origin[1]),
          );
          camera.position
            .copy(controls.target)
            .add(
              new THREE.Vector3(
                normal[0] * distance + u[0] * 0.4,
                -0.35,
                -normal[1] * distance - u[1] * 0.4,
              ),
            );
          controls.minDistance = 2;
          controls.update();
          return;
        }
        if (fromFront) {
          const height = size.y;
          controls.target.set(
            appearance.front.left[0] + (u[0] * width) / 2 - origin[0],
            height * 0.48,
            -(appearance.front.left[1] + (u[1] * width) / 2 - origin[1]),
          );
          camera.position
            .copy(controls.target)
            .add(
              new THREE.Vector3(
                normal[0] * height * 2.1,
                height * 0.08,
                -normal[1] * height * 2.1,
              ),
            );
        } else
          camera.position
            .copy(controls.target)
            .add(
              new THREE.Vector3(
                (normal[0] + u[0] * 0.48) * distance,
                distance * 0.49,
                -(normal[1] + u[1] * 0.48) * distance,
              ),
            );
        controls.update();
        return;
      }
      camera.position
        .copy(controls.target)
        .add(
          fromTop
            ? new THREE.Vector3(0, distance, 0.001)
            : new THREE.Vector3(
                distance * 0.85,
                distance * 0.62,
                distance * 0.62,
              ),
        );
      controls.update();
    };
    const viewSide = (side: ExteriorView) => {
      setView(side);
      setTop(false);
      if (side === "top") {
        setTop(true);
        frame(true);
        return;
      }
      if (side === "rear" && appearance?.rear && floorplan) {
        const point =
          floorplan.rooms.find((r) => r.id === appearance.rear?.outsideRoomId)
            ?.center ?? floorplan.spawn;
        const rearPoint = new THREE.Vector3(
          point[0],
          1.4,
          point[1],
        ).applyMatrix4(planToExterior(appearance, origin));
        const { u, normal, width } = frontFrame(appearance),
          aspect = container.clientWidth / container.clientHeight;
        const distance =
          Math.max(
            width /
              (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect),
            4.0 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
          ) * 1.35;
        controls.target.copy(rearPoint);
        camera.position
          .copy(rearPoint)
          .add(
            new THREE.Vector3(
              -normal[0] * distance + u[0] * distance * 0.3,
              distance * 0.9,
              normal[1] * distance - u[1] * distance * 0.3,
            ),
          );
        controls.minDistance = 2;
        controls.update();
        return;
      }
      frame(false, side === "front", side === "roof");
    };
    frame(false, false);
    if (sceneView.current) {
      camera.position.fromArray(sceneView.current.camera);
      controls.target.fromArray(sceneView.current.target);
      controls.update();
    }
    let animationFrame = 0;
    const requestRender = () => {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        controls.update();
        scene.updateMatrixWorld(true);
        setCutaway(revealHouse(camera, controls.target));
        if (north.current)
          north.current.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
        renderer.render(scene, camera);
      });
    };
    controls.addEventListener("change", requestRender);
    invalidate = requestRender;
    rig.current = createLightingRig(scene, renderer, data, requestRender);
    rig.current.update(
      lightState.current.lighting,
      lightState.current.lightSettings,
    );
    const pins = new THREE.Group();
    scene.add(pins);
    const cleanGroup = (group: THREE.Group) => {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      group.clear();
    };
    api.current = {
      view: viewSide,
      frame,
      zoom(factor) {
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
        controls.update();
      },
      photo() {
        renderer.render(scene, camera);
        const a = document.createElement("a");
        a.href = renderer.domElement.toDataURL("image/png");
        a.download = `${data.house.id}-3d.png`;
        a.click();
      },
      update(showContext, wireframe, current, currentAssets, showStyle) {
        renderer.shadowMap.needsUpdate = true;
        buildings.children.forEach((g) => {
          g.visible = g.userData.isTarget || showContext;
        });
        meshes.forEach((mesh) => {
          mesh.visible = !(
            showStyle &&
            !wireframe &&
            mesh.userData.isTarget &&
            ((shellDetails?.children.length &&
              appearance?.shell?.hiddenSurfaceIndices.includes(
                mesh.userData.surfaceIndex,
              )) ||
              appearance?.roof?.hiddenSurfaceIndices.includes(
                mesh.userData.surfaceIndex,
              ) ||
              appearance?.hiddenSurfaceIndices?.includes(
                mesh.userData.surfaceIndex,
              ) ||
              (rear &&
                appearance?.rear?.hiddenSurfaceIndices.includes(
                  mesh.userData.surfaceIndex,
                )))
          );
          const material = mesh.material as THREE.MeshStandardMaterial;
          const match = Boolean(
            current &&
            current.id !== `${data.house.id}:building` &&
            spatialAsset(mesh, data.house.id, currentAssets)?.id === current.id,
          );
          material.wireframe = wireframe;
          const textured = Boolean(
            showStyle && appearance && mesh.userData.isTarget,
          );
          const styleMap = textured
            ? (mesh.userData.styleMap as THREE.Texture | null)
            : null;
          const map =
            lightState.current.lightSettings.enabled &&
            styleMap?.userData.bakedLighting
              ? null
              : styleMap;
          const clip = textured && !wireframe ? mesh.userData.styleClip : null;
          if (material.clippingPlanes !== clip) {
            material.clippingPlanes = clip;
            material.needsUpdate = true;
          }
          if (material.map !== map) {
            material.map = map;
            material.needsUpdate = true;
          }
          material.color.set(
            mesh.userData.isTarget && match
              ? textured
                ? "#fff2d8"
                : "#F8891E"
              : textured
                ? mesh.userData.styleColor
                : mesh.userData.baseColor,
          );
          material.emissive.set(
            mesh.userData.isTarget && match ? "#4d2100" : "#000000",
          );
          material.emissiveIntensity = 0.12;
        });
        targetEdges.forEach((edges) => {
          edges.visible = !showStyle || !appearance;
        });
        details.visible = Boolean(showStyle && appearance && !wireframe);
        clearOutline();
        outline = selectionOutline(
          [...meshes, ...detailMeshes],
          data.house.id,
          currentAssets,
          current?.id ?? "",
        );
        scene.add(outline);
        grid.visible = showContext && !lightState.current.lightSettings.enabled;
        cleanGroup(pins);
        currentAssets
          .filter((a) => a.position)
          .forEach((asset) => {
            const p = asset.position!;
            const pin = new THREE.Mesh(
              new THREE.SphereGeometry(0.24, 16, 16),
              new THREE.MeshStandardMaterial({
                color: asset.id === current?.id ? "#FDCF35" : "#1F2B35",
                emissive: "#F8891E",
                emissiveIntensity: 0.2,
                depthTest: false,
              }),
            );
            pin.position.set(
              p[0] - origin[0],
              p[2] - origin[2],
              -(p[1] - origin[1]),
            );
            pin.userData.assetId = asset.id;
            pin.renderOrder = 5;
            pins.add(pin);
          });
        requestRender();
      },
    };
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tap = new SpatialTap();
    const pointerDown = (event: PointerEvent) => {
      tap.down(event);
    };
    const hitsAt = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      return visibleSpatialHit(
        raycaster.intersectObjects([buildings, details], true),
      );
    };
    const click = (event: PointerEvent) => {
      if (!tap.up(event)) return;
      const hit = hitsAt(event);
      const pin = visibleSpatialHit(raycaster.intersectObjects(pins.children));
      if (pin && !callbacks.current.placing) {
        callbacks.current.onSelect(pin.object.userData.assetId);
        return;
      }
      if (!hit) return;
      const asset = spatialAsset(
        hit.object,
        data.house.id,
        callbacks.current.assets,
      );
      if (!asset) return;
      if (callbacks.current.placing)
        callbacks.current.onPlace([
          +(hit.point.x + origin[0]).toFixed(3),
          +(-hit.point.z + origin[1]).toFixed(3),
          +(hit.point.y + origin[2]).toFixed(3),
        ]);
      else callbacks.current.onSelect(asset.id);
    };
    let hoverName = "";
    const pointerMove = (event: PointerEvent) => {
      tap.move(event);
      if (
        event.buttons ||
        event.pointerType === "touch" ||
        callbacks.current.placing
      )
        return;
      const hit = hitsAt(event);
      const pin = visibleSpatialHit(raycaster.intersectObjects(pins.children));
      const asset = spatialAsset(
        pin?.object ?? hit?.object ?? scene,
        data.house.id,
        callbacks.current.assets,
      );
      const next = asset?.name ?? "";
      renderer.domElement.style.cursor = next ? "pointer" : "grab";
      if (next !== hoverName) {
        hoverName = next;
        setHovered(next);
      }
    };
    const pointerLeave = () => {
      hoverName = "";
      setHovered("");
    };
    const pointerCancel = (event: PointerEvent) => tap.cancel(event);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", click);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointercancel", pointerCancel);
    renderer.domElement.addEventListener("pointerleave", pointerLeave);
    const onLost = (event: Event) => {
      event.preventDefault();
      onError(
        "De 3D-weergave is onderbroken. Herlaad de pagina om verder te kijken.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    const resize = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect =
        container.clientWidth / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      requestRender();
    });
    resize.observe(container);
    requestRender();
    return () => {
      sceneView.current = {
        camera: camera.position.toArray(),
        target: controls.target.toArray(),
      };
      resize.disconnect();
      cancelAnimationFrame(animationFrame);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      rig.current?.dispose();
      rig.current = null;
      api.current = null;
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("pointerleave", pointerLeave);
      clearOutline();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      renderer.dispose();
      facadeMap?.dispose();
      aerialMap?.dispose();
      textures?.stuccoMap.dispose();
      textures?.roofMap.dispose();
      rear?.textures.forEach((t) => t.dispose());
      renderer.domElement.remove();
    };
  }, [data, appearance, floorplan, onError]);
  useEffect(() => {
    rig.current?.update(lighting, lightSettings);
  }, [lighting, lightSettings, data, appearance, floorplan]);
  useEffect(() => {
    api.current?.update(context, wire, selected, assets, styled);
  }, [
    context,
    wire,
    selected,
    assets,
    data,
    appearance,
    floorplan,
    styled,
    lightSettings.enabled,
  ]);
  return (
    <section
      className={`viewer ${placing ? "placing" : ""} ${lightSettings.enabled ? "lighting-active" : ""}`}
      aria-label="Huis verkennen"
    >
      <div className="viewer-toolbar">
        <div className="segmented" role="group" aria-label="Weergave">
          <button
            aria-pressed={!top}
            className={!top ? "active" : ""}
            onClick={() => {
              setTop(false);
              api.current?.view("overview");
            }}
          >
            <Box size={16} /> 3D-model
          </button>
          <button
            aria-pressed={top}
            className={top ? "active" : ""}
            onClick={() => {
              setTop(true);
              api.current?.view("top");
            }}
          >
            <Scan size={16} /> Bovenaanzicht
          </button>
        </div>
        <div className="viewer-actions">
          <button
            className="icon-button photo-button"
            title="Bewaar afbeelding van het model"
            aria-label="Bewaar afbeelding van het model"
            onClick={() => api.current?.photo()}
          >
            <Camera size={18} />
          </button>
        </div>
      </div>
      <div className="scene" ref={host} />
      {hovered && !placing && (
        <div className="spatial-hover" aria-hidden="true">
          {hovered} <span>· klik voor informatie</span>
        </div>
      )}
      {failed && (
        <div className="viewer-failed">
          <Box size={32} />
          <h3>3D is niet beschikbaar</h3>
          <p>
            Schakel hardwareversnelling in je browser in. Je kunt het dossier
            hieronder wel gebruiken.
          </p>
        </div>
      )}
      <div className="model-label">
        <span className="orange-line" />
        <div>
          <strong>{data.house.address}</strong>
          <span>
            {appearance && styled
              ? "Gevelafwerking · visuele reconstructie"
              : `Gebouwmodel · ${data.source.detailLevel ?? "3DBAG LoD 2.2"}`}
          </span>
          {appearance && (
            <div className="view-choice">
              <select
                aria-label="Kies aanzicht"
                value={view}
                onChange={(event) =>
                  api.current?.view(event.target.value as ExteriorView)
                }
              >
                <option value="overview">Het hele huis</option>
                <option value="front">Voorkant</option>
                <option value="top">Bovenkant</option>
                {rearAvailable(floorplan, appearance) && (
                  <option value="rear">Achterkant en terras</option>
                )}
                <option value="roof">Dak van dichtbij</option>
              </select>
              {view === "rear" && floorplan && (
                <button onClick={onInterior}>
                  <Footprints size={14} /> Binnen kijken
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="compass" aria-label="Noordrichting" ref={north}>
        <span>N</span>
        <svg width="24" height="29" viewBox="0 0 24 29" aria-hidden="true">
          <path
            d="M12 2 21 25 12 20 3 25Z"
            fill="#637065"
            fillOpacity=".12"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path d="M12 2V20L3 25Z" fill="currentColor" />
        </svg>
      </div>
      <div className="layers">
        {appearance && (
          <label>
            <input
              type="checkbox"
              checked={styled}
              onChange={(event) => setStyled(event.target.checked)}
            />{" "}
            Gevelafwerking
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={context}
            onChange={(e) => onNeighbors(e.target.checked)}
          />{" "}
          Omgeving
        </label>
        <label>
          <input
            type="checkbox"
            checked={wire}
            onChange={(e) => setWire(e.target.checked)}
          />{" "}
          Draadmodel
        </label>
      </div>
      <div className="view-controls">
        <button
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => api.current?.zoom(0.8)}
        >
          <Plus size={19} />
        </button>
        <button
          aria-label="Zoom uit"
          title="Zoom uit"
          onClick={() => api.current?.zoom(1.25)}
        >
          <Minus size={19} />
        </button>
        <span />
        <button
          aria-label="Centreer het huis"
          title="Centreer het huis"
          onClick={() => api.current?.frame(top)}
        >
          <Focus size={19} />
        </button>
        <button
          aria-label="Herstel weergave"
          title="Herstel weergave"
          onClick={() => {
            setTop(false);
            setWire(false);
            onNeighbors(false);
            api.current?.frame();
          }}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="viewer-bottom">
        <span>
          {placing ? (
            <>
              <MapPin size={15} /> Klik op het gebouw om deze plek vast te
              leggen
            </>
          ) : (
            <>
              {cutaway ? (
                "Omgeving voor de kijker weggesneden; schaduw blijft behouden."
              ) : (
                <>
                  Sleep om te draaien <span className="dot-sep">·</span> Scroll
                  om te zoomen <span className="dot-sep">·</span> Klik op een
                  gevel of dak
                </>
              )}
            </>
          )}
        </span>
        <a
          href={data.source.infoUrl ?? "https://docs.3dbag.nl/nl/copyright/"}
          target="_blank"
          rel="noreferrer"
        >
          {data.source.credit ?? "3DBAG © TU Delft & 3DGI · CC BY 4.0"}
        </a>
      </div>
    </section>
  );
}

function rearAvailable(
  plan: Floorplan | null,
  appearance: HouseAppearance | null,
) {
  return Boolean(plan && appearance?.rear);
}

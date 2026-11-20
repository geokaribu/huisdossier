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
} from "lucide-react";
import { triangulateSurface } from "./geometry";
import type { HouseData, Asset, Point } from "./types";

interface Props {
  data: HouseData;
  assets: Asset[];
  selected: Asset | undefined;
  onSelect: (id: string) => void;
  placing: boolean;
  onPlace: (point: Point) => void;
  onError: (message: string) => void;
}
interface ViewerApi {
  frame: (top?: boolean) => void;
  zoom: (factor: number) => void;
  photo: () => void;
  update: (
    context: boolean,
    wire: boolean,
    selected: Asset | undefined,
    assets: Asset[],
  ) => void;
}

export function Viewer({
  data,
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
  const callbacks = useRef({ onSelect, onPlace, placing });
  callbacks.current = { onSelect, onPlace, placing };
  const [context, setContext] = useState(false);
  const [wire, setWire] = useState(false);
  const [top, setTop] = useState(false);
  const [failed, setFailed] = useState(false);

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
      left: -50,
      right: 50,
      top: 50,
      bottom: -50,
      near: 1,
      far: 120,
    });
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.04;
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
    const targetBox = new THREE.Box3();
    for (const building of data.buildings) {
      const group = new THREE.Group();
      group.userData.isTarget = building.target;
      for (const surface of building.surfaces) {
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
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.95,
          side: THREE.DoubleSide,
          flatShading: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          isTarget: building.target,
          surfaceType: surface.type,
          baseColor: color,
          buildingId: building.id,
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
      }
      buildings.add(group);
    }
    scene.add(buildings);
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
    const frame = (fromTop = false) => {
      controls.target.copy(center).y = fromTop ? 0 : size.y * 0.36;
      const distance = span * (container.clientWidth < 500 ? 3.4 : 2.6);
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
    frame();
    let animationFrame = 0;
    const requestRender = () => {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        controls.update();
        if (north.current)
          north.current.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
        renderer.render(scene, camera);
      });
    };
    controls.addEventListener("change", requestRender);
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
      update(showContext, wireframe, current, currentAssets) {
        buildings.children.forEach((g) => {
          g.visible = g.userData.isTarget || showContext;
        });
        meshes.forEach((mesh) => {
          const material = mesh.material as THREE.MeshStandardMaterial;
          const match =
            current?.kind === "dak"
              ? mesh.userData.surfaceType === "RoofSurface"
              : current?.kind === "gevel"
                ? mesh.userData.surfaceType === "WallSurface"
                : false;
          material.wireframe = wireframe;
          material.color.set(
            mesh.userData.isTarget && match
              ? "#F8891E"
              : mesh.userData.baseColor,
          );
          material.emissive.set(
            mesh.userData.isTarget && match ? "#4d2100" : "#000000",
          );
          material.emissiveIntensity = 0.12;
        });
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
    let down = [0, 0];
    const pointerDown = (event: PointerEvent) => {
      down = [event.clientX, event.clientY];
    };
    const click = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5)
        return;
      const bounds = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const pin = raycaster.intersectObjects(pins.children)[0];
      if (pin && !callbacks.current.placing) {
        callbacks.current.onSelect(pin.object.userData.assetId);
        return;
      }
      const hits = raycaster.intersectObjects(
        meshes.filter((m) => m.parent?.visible),
      );
      const hit = hits[0];
      if (!hit?.object.userData.isTarget) return;
      if (callbacks.current.placing)
        callbacks.current.onPlace([
          +(hit.point.x + origin[0]).toFixed(3),
          +(-hit.point.z + origin[1]).toFixed(3),
          +(hit.point.y + origin[2]).toFixed(3),
        ]);
      else
        callbacks.current.onSelect(
          `${data.house.id}:${hit.object.userData.surfaceType === "RoofSurface" ? "roof" : "facade"}`,
        );
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", click);
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
      resize.disconnect();
      cancelAnimationFrame(animationFrame);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      api.current = null;
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", click);
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
      renderer.domElement.remove();
    };
  }, [data, onError]);
  useEffect(() => {
    api.current?.update(context, wire, selected, assets);
  }, [context, wire, selected, assets, data]);
  return (
    <section
      className={`viewer ${placing ? "placing" : ""}`}
      aria-label="Huis verkennen"
    >
      <div className="viewer-toolbar">
        <div className="segmented" aria-label="Weergave">
          <button
            className={!top ? "active" : ""}
            onClick={() => {
              setTop(false);
              api.current?.frame(false);
            }}
          >
            <Box size={16} /> 3D-model
          </button>
          <button
            className={top ? "active" : ""}
            onClick={() => {
              setTop(true);
              api.current?.frame(true);
            }}
          >
            <Scan size={16} /> Bovenaanzicht
          </button>
        </div>
        <button
          className="icon-button photo-button"
          title="Bewaar afbeelding van het model"
          aria-label="Bewaar afbeelding van het model"
          onClick={() => api.current?.photo()}
        >
          <Camera size={18} />
        </button>
      </div>
      <div className="scene" ref={host} />
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
          <span>Gebouwmodel · 3DBAG LoD 2.2</span>
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
        <label>
          <input
            type="checkbox"
            checked={context}
            onChange={(e) => setContext(e.target.checked)}
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
            setContext(false);
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
              Sleep om te draaien <span className="dot-sep">·</span> Scroll om
              te zoomen <span className="dot-sep">·</span> Klik op een gevel of
              dak
            </>
          )}
        </span>
        <a
          href="https://docs.3dbag.nl/nl/copyright/"
          target="_blank"
          rel="noreferrer"
        >
          3DBAG © TU Delft & 3DGI · CC BY 4.0
        </a>
      </div>
    </section>
  );
}

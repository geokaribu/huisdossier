export type Point = [number, number, number];
export interface LampScenario {
  height: number;
  lumens: number;
  kelvin: number;
  distribution: "point" | "downward";
}
export interface LightingEnvironment {
  version: 1;
  latitude: number;
  longitude: number;
  timeZone: "Europe/Amsterdam";
  source: {
    url: string;
    attribution: string;
    license: string;
    fetchedAt: string;
    note: string;
  };
  lamps: {
    id: string;
    label: string;
    rd: [number, number];
    sourceType: string;
    armatureType: string | null;
    sourceDate: string | null;
    scenario: LampScenario;
  }[];
}
export interface LightingSettings {
  enabled: boolean;
  date: string;
  time: string;
  neighbors: boolean;
  streetLights: boolean;
  indoorLights: boolean;
  selectedLampId: string;
  exposure: number;
}
export interface Surface {
  type: string;
  rings: Point[][];
}
export interface Building {
  id: string;
  target: boolean;
  surfaces: Surface[];
  attributes: Record<string, unknown>;
}
export interface HouseData {
  house: {
    id: string;
    name: string;
    address: string;
    postcode: string;
    city: string;
    bagVboId: string;
    bagPandId: string;
    rd: [number, number];
    buildingYear?: number;
    area?: number;
    buildingUnitCount?: number;
  };
  source: {
    fetchedAt: string;
    attribution: string;
    license: string;
    urls: string[];
    [key: string]: unknown;
  };
  buildings: Building[];
}
export interface Asset {
  id: string;
  name: string;
  kind: string;
  description: string;
  position: Point | null;
  locationStatus: string;
  roomId?: string | null;
}
export interface Attachment {
  id: string;
  assetId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url: string;
  readable?: boolean;
  category?: string;
  summary?: string;
  source?: string;
  sourceDate?: string;
  historical?: boolean;
}
export interface Task {
  id: string;
  assetId: string;
  title: string;
  description: string;
  date: string;
  status: "open" | "done";
  createdAt: string;
  owner?: string;
  state?: "active" | "hold" | "verify";
  source?: string;
  sourceDate?: string;
  sourceId?: string | null;
  completedAt?: string;
}
export interface Dossier {
  assets: Asset[];
  attachments: Attachment[];
  tasks: Task[];
}
export interface HouseAppearance {
  shell?: {
    rearSurface: number;
    hiddenSurfaceIndices: number[];
    attribution: string;
  };
  version: 1;
  label: string;
  description: string;
  attribution: string;
  generated: boolean;
  hiddenSurfaceIndices?: number[];
  frontOpenings?: {
    id: string;
    kind: "window" | "door";
    x: number;
    width: number;
    bottom: number;
    height: number;
    split: number;
    tilt?: number;
  }[];
  rear?: {
    portalId: string;
    outsideRoomId: string;
    anchor: [number, number];
    scale: [number, number];
    shellStartZ: number;
    roofThickness: number;
    junctionTop: number;
    hiddenSurfaceIndices: number[];
    attribution: string;
  };
  flatRoof?: {
    surface: number;
    edgeHeight: number;
    fixtures: {
      id: string;
      kind: "vent" | "rooflight";
      across: number;
      depth: number;
      width: number;
      length: number;
      height: number;
    }[];
  };
  aerial?: {
    texture: string;
    bbox: [number, number, number, number];
    attribution: string;
    url: string;
    fetchedAt: string;
    nativeResolutionMetres?: number;
    captureDate?: string;
    sourceUrl?: string;
    license?: string;
    metadataNote?: string;
  };
  front: {
    left: [number, number];
    right: [number, number];
    bottom: number;
    top: number;
    texture: string;
  };
  materials: { wall: string; roof: string; plinth: string };
  dormerSurface?: number;
  roof?: {
    hiddenSurfaceIndices: number[];
    top: number;
    inset: number;
    dormerWidth: number;
    dormerInset: number;
    dormerBottom: number;
    awningWidth?: number;
    recess?: {
      width: number;
      bottomT: number;
      topT: number;
      depth: number;
      railingHeight: number;
    };
    windows?: {
      across: number;
      width: number;
      bottomT: number;
      topT: number;
    }[];
  };
}

export type PlanPoint = [number, number];
export interface GlazedJoinery {
  id: string;
  label: string;
  fixedLeft: number;
  insideColor: string;
  outsideColor: string;
  openAngle: number;
  defaultOpen: boolean;
}
export interface PlanDecoration {
  id: string;
  kind:
    | "patio-table"
    | "patio-chair"
    | "plant-shelf"
    | "planter"
    | "rain-pipe"
    | "sofa"
    | "armchair"
    | "coffee-table"
    | "indoor-plant"
    | "utility-niche"
    | "barbecue"
    | "storage-cabinet"
    | "hanging-planter"
    | "bookcase"
    | "dining-table"
    | "dining-chair"
    | "fridge"
    | "curtain"
    | "footstool"
    | "pendant"
    | "picture-frame"
    | "kitchen-run"
    | "kitchen-cabinet"
    | "wall-shelf"
    | "range-cooker"
    | "recliner"
    | "built-in";
  center: PlanPoint;
  size: PlanPoint;
  height: number;
  rotation?: number;
  base?: number;
  color?: string;
  plant?: "flowers" | "shrub";
  solid?: boolean;
  fixed?: boolean;
  contents?: boolean;
}
export interface PlanWall {
  outsideRoomId?: string;
  a: PlanPoint;
  b: PlanPoint;
  thickness: number;
  height?: number;
  openings: {
    offset: number;
    width: number;
    sill: number;
    height: number;
    kind: "door" | "window";
    frameColor?: string;
    joinery?: GlazedJoinery;
  }[];
  finish?: { color: string; texture: "stucco" | "brick" };
  coatings?: {
    side: "positive" | "negative";
    from: number;
    to: number;
    color: string;
    skirtingColor?: string;
    lower?: { color: string; height: number; railColor: string };
    pattern?: {
      texture: string;
      tileSize: PlanPoint;
      attribution: string;
      generated: boolean;
    };
  }[];
  climber?: { top: number; coverage: number; trellis: boolean };
}
export interface Floorplan {
  version: 1;
  label: string;
  source: string;
  description: string;
  ceilingHeight: number;
  outline: PlanPoint[];
  ceiling: PlanPoint[];
  spawn: PlanPoint;
  rooms: {
    id: string;
    name: string;
    polygon: PlanPoint[];
    center: PlanPoint;
    color: string;
    area?: number;
    outside?: boolean;
    shared?: boolean;
    floor?: "wood" | "tile";
    floorColor?: string;
    floorTiling?: { size: number; groutColor: string };
    paving?: { size: number; color: string };
    viewYaw?: number;
    viewPitch?: number;
    viewFov?: number;
  }[];
  walls: PlanWall[];
  fixtures: {
    kind:
      | "counter"
      | "sink"
      | "hob"
      | "toilet"
      | "basin"
      | "shower"
      | "closet"
      | "stairs";
    center: PlanPoint;
    size: PlanPoint;
    height: number;
    fixed?: boolean;
    mounting?: "wall";
    rotation?: number;
    base?: number;
  }[];
  decorations?: PlanDecoration[];
}

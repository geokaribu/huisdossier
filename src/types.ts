export type Point = [number, number, number];
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
}
export interface Attachment {
  id: string;
  assetId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url: string;
}
export interface Task {
  id: string;
  assetId: string;
  title: string;
  description: string;
  date: string;
  status: "open" | "done";
  createdAt: string;
}
export interface Dossier {
  assets: Asset[];
  attachments: Attachment[];
  tasks: Task[];
}

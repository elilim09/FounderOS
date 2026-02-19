import { BuildResult, DesignResult, WorkshopState } from "./types.js";

const designs = new Map<string, DesignResult>();
const builds = new Map<string, BuildResult>();

const workshops = new Map<string, WorkshopState>();

export function saveDesign(design: DesignResult): void {
  designs.set(design.designId, design);
}

export function getDesign(designId: string): DesignResult | undefined {
  return designs.get(designId);
}

export function saveBuild(build: BuildResult): void {
  builds.set(build.designId, build);
}

export function getBuild(designId: string): BuildResult | undefined {
  return builds.get(designId);
}


export function saveWorkshop(workshop: WorkshopState): void {
  workshops.set(workshop.designId, workshop);
}

export function getWorkshop(designId: string): WorkshopState | undefined {
  return workshops.get(designId);
}

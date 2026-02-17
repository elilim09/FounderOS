import { BuildResult, DesignResult } from "./types.js";

const designs = new Map<string, DesignResult>();
const builds = new Map<string, BuildResult>();

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

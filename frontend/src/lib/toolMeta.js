import {
  Boxes, Sparkles, FileCode2, Search, Mountain, Trees, Cpu,
} from "lucide-react";

export const TOOL_META = {
  create_instance: { icon: Boxes, label: "Create Instance", color: "#38BDF8" },
  modify_property: { icon: Sparkles, label: "Modify Property", color: "#A78BFA" },
  write_script: { icon: FileCode2, label: "Write Luau", color: "#4ADE80" },
  search_toolbox: { icon: Search, label: "Toolbox Search", color: "#FBBF24" },
  insert_toolbox_model: { icon: Boxes, label: "Insert Model", color: "#FBBF24" },
  sculpt_terrain: { icon: Mountain, label: "Sculpt Terrain", color: "#06B6D4" },
  paint_terrain_material: { icon: Mountain, label: "Paint Biome", color: "#F59E0B" },
  scatter_assets: { icon: Trees, label: "Scatter Assets", color: "#22C55E" },
  create_animation: { icon: Sparkles, label: "Create Animation", color: "#F472B6" },
};

export const toolMeta = (name) => TOOL_META[name] || { icon: Cpu, label: name, color: "#A78BFA" };

export const SUGGESTIONS = [
  "Create a red neon Beacon part with a pulsing transparency ModuleScript",
  "Build a main menu ScreenGui with Play, Settings and Quit buttons",
  "Generate a sakura forest map: sculpt terrain, paint grass biome, scatter 200 sakura trees and gravel",
  "Write a strict-typed sprint system LocalScript using ContextActionService",
  "Animate a floating platform that bobs up and down and slowly rotates forever",
];

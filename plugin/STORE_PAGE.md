# GUI Blox Connect — Roblox Creator Store Listing

**Icon:** `GuiBloxConnect_icon_512.png` (512×512, neon-purple block/bridge mark)
**Plugin file:** `GuiBloxConnect.server.lua`

---

## Title
GUI Blox Connect — AI Copilot Bridge

## Summary (short)
Prompt on the web, build in Studio. The official bridge for GUI Blox — your AI copilot that creates instances, writes modern Luau, imports Toolbox assets, and generates full procedural terrain, live in Roblox Studio.

## Description (long)
**GUI Blox Connect** is the background bridge plugin for [GUI Blox](https://guiblox.com), the Cloud-to-Studio AI copilot for Roblox creators.

Write what you want in plain language on the **GUI Blox web dashboard** — the plugin listens in the background, pulls the AI's action plan, and executes it directly in Studio.

### What it does
- **Instances & Properties** — spawns and configures Parts, Models, GUIs and more.
- **Modern Luau** — writes strict-typed Scripts, LocalScripts and ModuleScripts (task.wait, TweenService, RaycastParams).
- **Toolbox import** — inserts verified assets with scripts disabled for safety.
- **Procedural terrain** — real Perlin heightmap sculpting, biome-aware material painting, and Poisson-disk asset scatter with terrain-conforming CFrame placement (sakura forests, rocky fields, and more).
- **Animations** — TweenService motion (spin, bob, fade, pulse).
- **Undo-safe** — every action sets a `ChangeHistoryService` waypoint (Ctrl+Z friendly).
- **Live context** — forwards your Selection and runtime errors so you can "Fix with AI" from the web.

### How it works
1. Install the plugin.
2. In **Game Settings → Security**, enable **Allow HTTP Requests**.
3. Create an API key in the GUI Blox dashboard (**API & Bridge Keys**).
4. Paste the key into the plugin's widget. The status dot turns green when connected.
5. Prompt from the web — watch it build in Studio.

### Privacy & Safety
- Communicates only with the GUI Blox backend over HTTPS using your API key.
- Hard limits: ≤100 instances/action, ≤512³ terrain region, ≤500 scatter points.
- Imported Toolbox scripts are disabled on insert.
- Zero Data Retention — your prompts are never used to train external AI.

## Tags
ai, copilot, terrain, luau, gui, builder, productivity, automation, bridge

## Category
Building / Scripting

## Permissions requested
- HTTP Requests (to reach the GUI Blox backend)
- Script injection (to create/modify instances you request)

## Links
- Website: https://guiblox.com
- Dashboard: https://guiblox.com/workspace
- Support: support@guiblox.com

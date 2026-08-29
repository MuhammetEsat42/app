--!strict
-- GUI Blox Connect — Cloud-to-Studio Bridge Plugin
-- Background listener/executor for the GUI Blox web dashboard.
-- Polls the backend command queue every 2s, executes actions in Studio,
-- and streams results/logs back. Prompts are written on the WEB dashboard only.

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local Selection = game:GetService("Selection")
local LogService = game:GetService("LogService")
local InsertService = game:GetService("InsertService")
local TweenService = game:GetService("TweenService")

-- ⬇️ Set this to your deployed GUI Blox backend URL
local BASE_URL = "https://guiblox-ai.preview.emergentagent.com/api"
local POLL_INTERVAL = 2

-- Hard-limits (mirror backend)
local MAX_INSTANCES = 100
local MAX_SCATTER = 500
local MAX_TERRAIN = 512

------------------------------------------------------------------
-- Plugin UI: minimal status widget
------------------------------------------------------------------
local toolbar = plugin:CreateToolbar("GUI Blox")
local toggleButton = toolbar:CreateButton("Connect", "Open GUI Blox Connect", "rbxassetid://0")

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right, false, false, 260, 180, 240, 160
)
local widget = plugin:CreateDockWidgetPluginGui("GuiBloxConnect", widgetInfo)
widget.Title = "GUI Blox Connect"

local root = Instance.new("Frame")
root.Size = UDim2.fromScale(1, 1)
root.BackgroundColor3 = Color3.fromRGB(13, 13, 20)
root.BorderSizePixel = 0
root.Parent = widget

local function makeLabel(text, y, color)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, -20, 0, 22)
	l.Position = UDim2.new(0, 10, 0, y)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.Gotham
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.TextColor3 = color or Color3.fromRGB(248, 250, 252)
	l.TextSize = 13
	l.Text = text
	l.Parent = root
	return l
end

local statusLabel = makeLabel("● Disconnected", 12, Color3.fromRGB(239, 68, 68))
local creditsLabel = makeLabel("Credits: —", 40)
local activityLabel = makeLabel("Idle", 68, Color3.fromRGB(148, 163, 184))

local apiKeyBox = Instance.new("TextBox")
apiKeyBox.Size = UDim2.new(1, -20, 0, 28)
apiKeyBox.Position = UDim2.new(0, 10, 0, 96)
apiKeyBox.PlaceholderText = "Paste API key (gb_...)"
apiKeyBox.Text = plugin:GetSetting("gb_api_key") or ""
apiKeyBox.BackgroundColor3 = Color3.fromRGB(26, 25, 43)
apiKeyBox.TextColor3 = Color3.fromRGB(248, 250, 252)
apiKeyBox.Font = Enum.Font.Code
apiKeyBox.TextSize = 12
apiKeyBox.ClearTextOnFocus = false
apiKeyBox.Parent = root

local dashBtn = Instance.new("TextButton")
dashBtn.Size = UDim2.new(1, -20, 0, 30)
dashBtn.Position = UDim2.new(0, 10, 0, 134)
dashBtn.Text = "Open Dashboard"
dashBtn.BackgroundColor3 = Color3.fromRGB(139, 92, 246)
dashBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
dashBtn.Font = Enum.Font.GothamBold
dashBtn.TextSize = 13
dashBtn.Parent = root

toggleButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

apiKeyBox.FocusLost:Connect(function()
	plugin:SetSetting("gb_api_key", apiKeyBox.Text)
end)

------------------------------------------------------------------
-- HTTP helpers (constant headers, API-key auth)
------------------------------------------------------------------
local function apiKey(): string
	return apiKeyBox.Text
end

local function request(method: string, path: string, body: any?): any?
	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = BASE_URL .. path,
			Method = method,
			Headers = {
				["Content-Type"] = "application/json",
				["X-API-Key"] = apiKey(),
			},
			Body = body and HttpService:JSONEncode(body) or nil,
		})
	end)
	if not ok then return nil end
	if res.Success then return HttpService:JSONDecode(res.Body) end
	return nil
end

------------------------------------------------------------------
-- Shared helpers
------------------------------------------------------------------
local function resolveParent(pathStr: string?): Instance
	if not pathStr or pathStr == "" then return workspace end
	local map = {
		Workspace = workspace,
		StarterGui = game:GetService("StarterGui"),
		ReplicatedStorage = game:GetService("ReplicatedStorage"),
		ServerScriptService = game:GetService("ServerScriptService"),
		StarterPlayerScripts = game:GetService("StarterPlayer"),
		Lighting = game:GetService("Lighting"),
	}
	return map[pathStr] or workspace
end

local function applyProperties(inst: Instance, props: {[string]: any}?)
	if not props then return end
	for k, v in pairs(props) do
		pcall(function()
			if typeof(v) == "table" and #v == 3 then
				if k:find("Color") then
					inst[k] = Color3.fromRGB(v[1], v[2], v[3])
				elseif k == "Size" or k == "Position" then
					inst[k] = Vector3.new(v[1], v[2], v[3])
				else
					inst[k] = v
				end
			else
				inst[k] = v
			end
		end)
	end
end

-- Terrain-conforming raycast (only hits Terrain)
local function terrainRaycast(x: number, z: number, topY: number, botY: number): RaycastResult?
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { workspace.Terrain }
	return workspace:Raycast(Vector3.new(x, topY, z), Vector3.new(0, botY - topY, 0), params)
end

-- Build a procedural scattered asset at a world position (real CFrame placement)
local function buildScatterAsset(parent: Instance, pos: Vector3, yaw: number, isTree: boolean, assetLower: string)
	if isTree then
		local model = Instance.new("Model")
		model.Name = "Tree"
		local h = 6 + math.random() * 6
		local trunk = Instance.new("Part")
		trunk.Anchored = true
		trunk.Size = Vector3.new(1.2, h, 1.2)
		trunk.CFrame = CFrame.new(pos + Vector3.new(0, h / 2, 0)) * CFrame.Angles(0, yaw, 0)
		trunk.Material = Enum.Material.Wood
		trunk.Color = Color3.fromRGB(94, 60, 38)
		trunk.Parent = model
		local canopy = Instance.new("Part")
		canopy.Anchored = true
		canopy.Shape = Enum.PartType.Ball
		local cs = 5 + math.random() * 3
		canopy.Size = Vector3.new(cs, cs, cs)
		canopy.CFrame = CFrame.new(pos + Vector3.new(0, h + cs * 0.3, 0))
		canopy.Material = Enum.Material.Grass
		canopy.Color = assetLower:find("sakura") and Color3.fromRGB(244, 164, 196) or Color3.fromRGB(46, 120, 54)
		canopy.Parent = model
		model.PrimaryPart = trunk
		model.Parent = parent
	else
		local rock = Instance.new("Part")
		rock.Anchored = true
		local s = 1.5 + math.random() * 3
		rock.Size = Vector3.new(s, s * 0.7, s * 0.9)
		rock.CFrame = CFrame.new(pos + Vector3.new(0, s * 0.3, 0))
			* CFrame.Angles(math.random() * 0.4, yaw, math.random() * 0.4)
		rock.Material = Enum.Material.Slate
		rock.Color = Color3.fromRGB(120, 120, 128)
		rock.Parent = parent
	end
end

------------------------------------------------------------------
-- Executor Tool Suite
------------------------------------------------------------------
local Executors = {}

function Executors.create_instance(p): (boolean, {string})
	local inst = Instance.new(p.class_name)
	inst.Name = p.name or p.class_name
	applyProperties(inst, p.properties)
	inst.Parent = resolveParent(p.parent)
	return true, { ("Created %s '%s' under %s"):format(p.class_name, inst.Name, p.parent or "Workspace") }
end

function Executors.modify_property(p): (boolean, {string})
	local targets = {}
	if p.target == "Selection" then
		targets = Selection:Get()
	else
		local found = workspace:FindFirstChild(p.target, true)
		if found then table.insert(targets, found) end
	end
	for _, t in ipairs(targets) do
		applyProperties(t, p.properties)
	end
	return true, { ("Modified %d instance(s)"):format(#targets) }
end

function Executors.write_script(p): (boolean, {string})
	local classMap = { Script = "Script", LocalScript = "LocalScript", ModuleScript = "ModuleScript" }
	local s = Instance.new(classMap[p.script_type] or "Script")
	s.Name = p.name or "GuiBloxScript"
	local src = p.source or ""
	src = src:gsub("while%s+true%s+do", "while true do task.wait()")
	s.Source = src
	s.Parent = resolveParent(p.parent)
	return true, { ("Wrote %s '%s' (%d chars)"):format(p.script_type, s.Name, #src) }
end

function Executors.search_toolbox(p): (boolean, {string})
	return true, { ("Toolbox search queued: '%s' (executed via web preview)"):format(p.query or "") }
end

function Executors.insert_toolbox_model(p): (boolean, {string})
	local ok, model = pcall(function()
		return InsertService:LoadAsset(p.asset_id)
	end)
	if ok and model then
		for _, d in ipairs(model:GetDescendants()) do
			if d:IsA("LuaSourceContainer") then d.Disabled = true end
		end
		model.Parent = resolveParent(p.parent)
		return true, { ("Inserted asset %d (scripts disabled)"):format(p.asset_id) }
	end
	return false, { "Failed to insert asset" }
end

-- Procedural Perlin heightmap sculpt: real FillBlock columns
function Executors.sculpt_terrain(p): (boolean, {string})
	local terrain = workspace.Terrain
	local size = p.region_size or { 200, 60, 200 }
	size[1] = math.min(size[1] or 200, MAX_TERRAIN)
	size[2] = math.min(size[2] or 60, MAX_TERRAIN)
	size[3] = math.min(size[3] or 200, MAX_TERRAIN)
	local center = p.center or { 0, 0, 0 }
	local mat = Enum.Material[p.material] or Enum.Material.Grass
	local amp = p.amplitude or math.max(12, size[2] * 0.6)
	local res = 8
	local seed = math.random() * 1000
	local sx, sy, sz = size[1], size[2], size[3]
	local cx, cy, cz = center[1], center[2], center[3]
	local baseY = cy - sy / 2
	local cols = 0
	local nx = math.floor(sx / res)
	local nz = math.floor(sz / res)
	for ix = 0, nx do
		for iz = 0, nz do
			local wx = cx - sx / 2 + ix * res
			local wz = cz - sz / 2 + iz * res
			-- layered Perlin noise for natural rolling terrain
			local n = math.noise(wx / 60 + seed, wz / 60 + seed) * 0.6
				+ math.noise(wx / 25 + seed, wz / 25 + seed) * 0.3
				+ math.noise(wx / 12 + seed, wz / 12 + seed) * 0.1
			local h = math.max(res, (n + 0.5) * amp)
			local colCF = CFrame.new(wx, baseY + h / 2, wz)
			pcall(function()
				terrain:FillBlock(colCF, Vector3.new(res, h, res), mat)
			end)
			cols += 1
			if cols % 200 == 0 then task.wait() end
		end
	end
	return true, { ("Sculpted Perlin heightmap: %d columns %dx%dx%d, amp %.0f"):format(cols, sx, sy, sz, amp) }
end

-- Biome-aware painting: height-banded material stamps on the terrain surface
function Executors.paint_terrain_material(p): (boolean, {string})
	local terrain = workspace.Terrain
	local mats = {}
	for _, m in ipairs(p.materials or {}) do
		local e = Enum.Material[m]
		if e then table.insert(mats, e) end
	end
	if #mats == 0 then mats = { Enum.Material.Sand, Enum.Material.Grass, Enum.Material.Rock, Enum.Material.Snow } end
	local size = p.region_size or { 200, 60, 200 }
	local center = p.center or { 0, 0, 0 }
	local sx = math.min(size[1] or 200, MAX_TERRAIN)
	local sz = math.min(size[3] or 200, MAX_TERRAIN)
	local sy = size[2] or 60
	local cx, cy, cz = center[1], center[2], center[3]
	local topY, botY = cy + sy, cy - sy
	local res = 10
	local painted = 0
	for ix = 0, math.floor(sx / res) do
		for iz = 0, math.floor(sz / res) do
			local wx = cx - sx / 2 + ix * res
			local wz = cz - sz / 2 + iz * res
			local r = terrainRaycast(wx, wz, topY, botY)
			if r then
				local frac = math.clamp((r.Position.Y - botY) / math.max(1, (topY - botY)), 0, 1)
				local idx = math.clamp(math.floor(frac * #mats) + 1, 1, #mats)
				pcall(function() terrain:FillBall(r.Position, res * 0.9, mats[idx]) end)
				painted += 1
				if painted % 150 == 0 then task.wait() end
			end
		end
	end
	return true, { ("Painted biome '%s': %d surface stamps, %d materials"):format(p.biome or "custom", painted, #mats) }
end

-- Poisson-disk grid scatter with real CFrame placement + terrain raycast conforming
function Executors.scatter_assets(p): (boolean, {string})
	local count = math.min(p.count or 50, MAX_SCATTER)
	local size = p.region_size or { 200, 100, 200 }
	local center = p.center or { 0, 0, 0 }
	local sx, sz = size[1] or 200, size[3] or 200
	local cx, cy, cz = center[1], center[2], center[3]
	local topY, botY = cy + (size[2] or 100), cy - (size[2] or 100)
	local jitter = p.jitter or 0.4
	local spacing = p.min_spacing or math.max(4, math.sqrt((sx * sz) / math.max(count, 1)))

	local folder = Instance.new("Folder")
	folder.Name = "GuiBlox_Scatter_" .. tostring(p.asset or "asset")
	folder.Parent = workspace

	local assetLower = string.lower(tostring(p.asset or ""))
	local isTree = (assetLower:find("tree") or assetLower:find("sakura") or assetLower:find("pine")) ~= nil
	local placed = 0
	local cols = math.max(1, math.floor(sx / spacing))
	local rows = math.max(1, math.floor(sz / spacing))
	for gx = 0, cols do
		for gz = 0, rows do
			if placed >= count then break end
			local jx = (math.random() - 0.5) * spacing * jitter * 2
			local jz = (math.random() - 0.5) * spacing * jitter * 2
			local wx = cx - sx / 2 + gx * spacing + jx
			local wz = cz - sz / 2 + gz * spacing + jz
			local r = terrainRaycast(wx, wz, topY, botY)
			if r then
				buildScatterAsset(folder, r.Position, math.random() * math.pi * 2, isTree, assetLower)
				placed += 1
				if placed % 50 == 0 then task.wait() end
			end
		end
		if placed >= count then break end
	end
	return true, { ("Scattered %d x %s via Poisson-grid raycast (spacing %.1f, jitter %.2f)"):format(placed, tostring(p.asset or "asset"), spacing, jitter) }
end

function Executors.create_animation(p): (boolean, {string})
	local targets = {}
	if p.target == "Selection" then
		targets = Selection:Get()
	else
		local found = workspace:FindFirstChild(p.target, true)
		if found then table.insert(targets, found) end
	end
	if #targets == 0 then return false, { "Animation target not found" } end

	local style = Enum.EasingStyle[p.easing_style] or Enum.EasingStyle.Quad
	local dir = Enum.EasingDirection[p.easing_direction] or Enum.EasingDirection.Out
	local info = TweenInfo.new(p.duration or 1, style, dir, p.repeat_count or 0, p.reverses or false)

	local goal = {}
	for k, v in pairs(p.goal or {}) do
		if typeof(v) == "table" and #v == 3 then
			if k:find("Color") then
				goal[k] = Color3.fromRGB(v[1], v[2], v[3])
			else
				goal[k] = Vector3.new(v[1], v[2], v[3])
			end
		else
			goal[k] = v
		end
	end
	for _, t in ipairs(targets) do
		pcall(function() TweenService:Create(t, info, goal):Play() end)
	end
	return true, { ("Animated %d instance(s) over %.1fs"):format(#targets, p.duration or 1) }
end

------------------------------------------------------------------
-- Execute a command with undo waypoint
------------------------------------------------------------------
local function execute(cmd)
	local fn = Executors[cmd.type]
	activityLabel.Text = "Running: " .. cmd.type
	if not fn then
		request("POST", "/bridge/result", { command_id = cmd.id, status = "error", error = "Unknown command: " .. cmd.type, logs = {} })
		return
	end
	ChangeHistoryService:SetWaypoint("GUI Blox: before " .. cmd.type)
	local ok, logs = pcall(fn, cmd.payload)
	if typeof(logs) ~= "table" then logs = { tostring(logs) } end
	ChangeHistoryService:SetWaypoint("GUI Blox: " .. cmd.type)
	request("POST", "/bridge/result", {
		command_id = cmd.id,
		status = ok and "done" or "error",
		error = (not ok) and (logs[1] or "execution failed") or nil,
		logs = logs,
		result = { tool = cmd.type },
	})
end

------------------------------------------------------------------
-- Context sync: forward selection + open script
------------------------------------------------------------------
Selection.SelectionChanged:Connect(function()
	local names = {}
	for _, inst in ipairs(Selection:Get()) do
		table.insert(names, inst:GetFullName())
	end
	request("POST", "/bridge/context", { selection = names })
end)

LogService.MessageOut:Connect(function(message, msgType)
	if msgType == Enum.MessageType.MessageError then
		request("POST", "/bridge/log", { level = "error", message = message, source = "studio" })
	end
end)

------------------------------------------------------------------
-- Polling loop (every 2s)
------------------------------------------------------------------
task.spawn(function()
	while true do
		if apiKey() ~= "" then
			local data = request("POST", "/bridge/poll", {})
			if data then
				statusLabel.Text = "● Connected"
				statusLabel.TextColor3 = Color3.fromRGB(16, 185, 129)
				creditsLabel.Text = "Credits: " .. tostring(data.credits or 0)
				local cmds = data.commands or {}
				if #cmds > 0 then
					for _, cmd in ipairs(cmds) do
						execute(cmd)
					end
				else
					activityLabel.Text = "Idle"
				end
			else
				statusLabel.Text = "● Disconnected"
				statusLabel.TextColor3 = Color3.fromRGB(239, 68, 68)
			end
		end
		task.wait(POLL_INTERVAL)
	end
end)

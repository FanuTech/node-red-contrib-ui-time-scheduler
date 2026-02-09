/*
MIT License
Copyright (c) 2020 Mario Fellinger
(Heavily modified for per-device TZ and Single Schedule)
*/

module.exports = function(RED) {
	'use strict';

	function HTML(config) {
		const uniqueId = config.id.replace(".", "");
		const divPrimary = "ui-ts-" + uniqueId;

		// We include a list of common timezones for the dropdown
		const timezones = [
			"UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
			"America/Phoenix", "America/Anchorage", "America/Honolulu", "Europe/London",
			"Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata",
			"Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Australia/Perth",
			"Pacific/Auckland"
		];

		const styles = String.raw`
		<style>
			#${divPrimary} { padding: 0; }
			#${divPrimary} .device-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 10px;
				border-bottom: 1px solid var(--nr-dashboard-groupBorderColor);
			}
			#${divPrimary} .device-info { display: flex; flex-direction: column; }
			#${divPrimary} .device-name { font-weight: bold; font-size: 1.1em; color: var(--nr-dashboard-widgetTextColor); }
			#${divPrimary} .device-meta { font-size: 0.85em; opacity: 0.7; color: var(--nr-dashboard-widgetTextColor); }
			#${divPrimary} .weekDay {
				display: inline-block; width: 20px; text-align: center;
				font-size: 0.8em; opacity: 0.3;
				color: var(--nr-dashboard-widgetTextColor);
			}
			#${divPrimary} .weekDayActive { opacity: 1; font-weight: bold; }
			
			/* Edit View Styles */
			#${divPrimary}-edit {
				display: none;
				padding: 10px;
				background: var(--nr-dashboard-widgetColor);
			}
			#${divPrimary} md-input-container { width: 100%; margin: 5px 0; }
			#${divPrimary} .btn-group { display: flex; justify-content: flex-end; margin-top: 10px; }
		</style>
		`;

		const script = String.raw`
		<script>
			// inject timezones into scope if needed or handle in init
		</script>
		`;

		const layout = String.raw`
		<div id="${divPrimary}" ng-init='init(${JSON.stringify(config)}, ${JSON.stringify(timezones)})'>
			
			<div id="view-list-${uniqueId}">
				<div class="device-row" ng-repeat="device in devices track by $index">
					<div class="device-info">
						<span class="device-name">{{device}}</span>
						<span class="device-meta">
							<span ng-if="getDeviceSchedule($index)">
								{{getDeviceSchedule($index).summary}} 
								<br>
								<small>Zone: {{getDeviceTimezone($index)}}</small>
							</span>
							<span ng-if="!getDeviceSchedule($index)">No Schedule</span>
						</span>
					</div>
					<md-button class="md-icon-button" ng-click="editDevice($index)">
						<md-icon>edit</md-icon>
					</md-button>
				</div>
			</div>

			<div id="view-edit-${uniqueId}" style="display:none;">
				<h4 style="margin-top:0; color:var(--nr-dashboard-widgetTextColor)">Edit: {{editingDeviceName}}</h4>
				
				<form ng-submit="saveDevice()">
					<md-input-container>
						<label>Timezone</label>
						<md-select ng-model="editor.timezone">
							<md-option ng-repeat="tz in availableTimezones" value="{{tz}}">{{tz}}</md-option>
						</md-select>
					</md-input-container>

					<div layout="row" layout-align="space-between center">
						<md-input-container flex="45">
							<label>Start Time</label>
							<input type="time" ng-model="editor.startTimeStr" required>
						</md-input-container>
						
						<md-input-container flex="45">
							<label>End Time</label>
							<input type="time" ng-model="editor.endTimeStr" required>
						</md-input-container>
					</div>

					<div layout="row" layout-wrap style="margin-bottom: 15px;">
						<div flex="100" style="color:var(--nr-dashboard-widgetTextColor); margin-bottom:5px;">Active Days</div>
						<md-button 
							ng-repeat="day in days" 
							class="md-icon-button" 
							style="margin:0; width:35px; background-color: {{editor.days[$index] ? 'var(--nr-dashboard-widgetColor)' : 'transparent'}}; border: 1px solid var(--nr-dashboard-groupBorderColor); opacity: {{editor.days[$index] ? 1 : 0.4}}"
							ng-click="toggleDay($index)">
							{{day.substring(0,1)}}
						</md-button>
					</div>

					<div class="btn-group">
						<md-button ng-click="cancelEdit()">Cancel</md-button>
						<md-button class="md-raised md-primary" type="submit">Save</md-button>
						<md-button class="md-raised md-warn" ng-click="clearSchedule()" type="button" style="margin-left:10px;">Clear</md-button>
					</div>
				</form>
			</div>

		</div>
		`;

		return String.raw`${styles}${layout}`;
	}

	function checkConfig(config, node) {
		if (!config) {
			node.error("No config");
			return false;
		}
		if (!config.hasOwnProperty("group")) {
			node.error("No group");
			return false;
		}
		return true;
	}

	function TimeSchedulerNode(config) {
		try {
			let ui = undefined;
			if (ui === undefined) {
				ui = RED.require("node-red-dashboard")(RED);
			}

			RED.nodes.createNode(this, config);
			const node = this;

			if (!config.hasOwnProperty("refresh")) config.refresh = 60;
			if (!config.hasOwnProperty("devices") || config.devices.length === 0) config.devices = [config.name];
			
			config.i18n = RED._("time-scheduler.ui", { returnObjects: true });

			if (checkConfig(config, node)) {
				const done = ui.addWidget({
					node: node,
					format: HTML(config),
					templateScope: "local",
					group: config.group,
					width: config.width,
					height: config.height,
					order: config.order,
					emitOnlyNewValues: false,
					forwardInputMessages: false,
					storeFrontEndInputAsState: true,
					persistantFrontEndValue: true,
					beforeEmit: function(msg, value) {
						if (msg.hasOwnProperty("getStatus")) {
							msg.payload = serializeData();
							node.send(msg);
							return msg;
						} else {
							// Process incoming UI update
							try {
								const parsedInput = JSON.parse(value);
								
								// Input expects: { timers: [], settings: { timezones: {} } }
								if (parsedInput.timers) {
									setTimers(parsedInput.timers);
								}
								if (parsedInput.settings) {
									setSettings(parsedInput.settings);
								}
								
								node.status({ fill: "green", shape: "dot", text: "Updated" });
							} catch (e) {
								node.error(e);
							}
						}
						return { msg: [msg] };
					},
					initController: function($scope) {
						$scope.init = function(config, timezones) {
							$scope.nodeId = config.id;
							$scope.days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
							$scope.devices = config.devices;
							$scope.availableTimezones = timezones;
							$scope.timers = [];
							$scope.settings = { timezones: {} };
							
							// Load data
							$scope.getDataFromServer();
						}

						// --- Display Helpers ---
						$scope.getDeviceSchedule = function(index) {
							const t = $scope.timers.find(x => x.output == index);
							if (!t) return null;
							
							const start = new Date(t.starttime);
							const end = new Date(t.endtime);
							const startStr = $scope.pad(start.getHours()) + ":" + $scope.pad(start.getMinutes());
							const endStr = $scope.pad(end.getHours()) + ":" + $scope.pad(end.getMinutes());
							
							// Check active days
							let dayStr = "";
							let allDays = true;
							for(let i=0; i<7; i++) {
								if(t.days[i]) dayStr += $scope.days[i].substring(0,1) + " ";
								else allDays = false;
							}
							if(allDays) dayStr = "Everyday";

							return {
								summary: `${startStr} - ${endStr} (${dayStr})`
							};
						}

						$scope.getDeviceTimezone = function(index) {
							if ($scope.settings && $scope.settings.timezones && $scope.settings.timezones[index]) {
								return $scope.settings.timezones[index];
							}
							return "UTC"; // Default
						}

						$scope.pad = function(n) { return n < 10 ? '0'+n : n; }

						// --- Edit Logic ---
						$scope.editDevice = function(index) {
							$scope.activeDeviceIndex = index;
							$scope.editingDeviceName = $scope.devices[index];

							// Setup Editor Defaults
							$scope.editor = {
								timezone: $scope.getDeviceTimezone(index),
								days: [0,0,0,0,0,0,0], // Sun-Sat
								startTimeStr: "08:00",
								endTimeStr: "17:00"
							};

							// Load existing timer if any
							const t = $scope.timers.find(x => x.output == index);
							if (t) {
								$scope.editor.days = t.days;
								const sDate = new Date(t.starttime);
								const eDate = new Date(t.endtime);
								$scope.editor.startTimeStr = $scope.formatTimeInput(sDate);
								$scope.editor.endTimeStr = $scope.formatTimeInput(eDate);
							} else {
								// Default Mon-Fri
								$scope.editor.days = [0,1,1,1,1,1,0]; 
							}

							// Toggle Views
							document.getElementById("view-list-" + $scope.nodeId.replace(".","")).style.display = "none";
							document.getElementById("view-edit-" + $scope.nodeId.replace(".","")).style.display = "block";
						}

						$scope.cancelEdit = function() {
							document.getElementById("view-edit-" + $scope.nodeId.replace(".","")).style.display = "none";
							document.getElementById("view-list-" + $scope.nodeId.replace(".","")).style.display = "block";
						}

						$scope.toggleDay = function(dayIndex) {
							$scope.editor.days[dayIndex] = $scope.editor.days[dayIndex] ? 0 : 1;
						}

						$scope.saveDevice = function() {
							const idx = $scope.activeDeviceIndex;
							
							// 1. Update Timezone Settings
							if (!$scope.settings.timezones) $scope.settings.timezones = {};
							$scope.settings.timezones[idx] = $scope.editor.timezone;

							// 2. Create Timer Object
							// We use an arbitrary date for start/end, only HH:MM matters for logic
							const baseDate = new Date();
							const sParts = $scope.editor.startTimeStr.split(":");
							const eParts = $scope.editor.endTimeStr.split(":");

							const startDate = new Date(0,0,0, sParts[0], sParts[1]);
							const endDate = new Date(0,0,0, eParts[0], eParts[1]);

							const newTimer = {
								output: idx,
								starttime: startDate.getTime(), // Stored as timestamp 1899-12-31...
								endtime: endDate.getTime(),
								days: $scope.editor.days
							};

							// Remove old timer for this device
							$scope.timers = $scope.timers.filter(t => t.output != idx);
							// Add new
							$scope.timers.push(newTimer);

							$scope.sendData();
							$scope.cancelEdit();
						}

						$scope.clearSchedule = function() {
							const idx = $scope.activeDeviceIndex;
							$scope.timers = $scope.timers.filter(t => t.output != idx);
							
							// Allow timezone update even if clearing schedule
							if (!$scope.settings.timezones) $scope.settings.timezones = {};
							$scope.settings.timezones[idx] = $scope.editor.timezone;

							$scope.sendData();
							$scope.cancelEdit();
						}

						$scope.formatTimeInput = function(dateObj) {
							return $scope.pad(dateObj.getHours()) + ":" + $scope.pad(dateObj.getMinutes());
						}

						// --- Data Sync ---
						$scope.sendData = function() {
							const payload = {
								timers: angular.copy($scope.timers),
								settings: angular.copy($scope.settings)
							};
							$scope.send({ payload: payload });
						}

						$scope.getDataFromServer = function() {
							$.ajax({
								url: "time-scheduler/getNode/" + $scope.nodeId, dataType: 'json',
								success: function(json) {
									$scope.timers = json.timers || [];
									$scope.settings = json.settings || { timezones: {} };
									$scope.$digest();
								}
							});
						}
					}
				});

				let nodeInterval;

				// Initialization
				(() => {
					let timers = getContextValue('timers') || [];
					let settings = getContextValue('settings') || { timezones: {} };
					setTimers(timers);
					setSettings(settings);
					
					createInitTimeout();
				})();

				function getContextValue(key) {
					return config.customContextStore && RED.settings.contextStorage && RED.settings.contextStorage.hasOwnProperty(config.customContextStore) ?
						node.context().get(key, config.customContextStore) : node.context().get(key);
				}

				function setContextValue(key, value) {
					config.customContextStore && RED.settings.contextStorage && RED.settings.contextStorage.hasOwnProperty(config.customContextStore) ?
						node.context().set(key, value, config.customContextStore) : node.context().set(key, value);
				}

				function setTimers(t) { setContextValue('timers', t); }
				function getTimers() { return getContextValue('timers') || []; }
				function setSettings(s) { setContextValue('settings', s); }
				function getSettings() { return getContextValue('settings') || { timezones: {} }; }

				function createInitTimeout() {
					// Align to next minute
					const today = new Date();
					const remaining = 60 - today.getSeconds(); 
					setTimeout(function() {
						nodeInterval = setInterval(intervalTimerFunction, 60000); // Check every minute
						intervalTimerFunction();
					}, remaining * 1000);
				}

				function intervalTimerFunction() {
					const outputValues = [null]; // Msg object container
					
					// Calculate state for each device
					for (let i = 0; i < config.devices.length; i++) {
						const isOn = isDeviceActive(i);
						const msg = { payload: isOn, topic: config.devices[i] };
						outputValues.push(msg);
					}

					node.send(outputValues);
				}

				// --- CORE LOGIC: Timezone Aware Check ---
				function isDeviceActive(deviceIndex) {
					const timers = getTimers();
					const settings = getSettings();
					
					// Find schedule for this device
					const timer = timers.find(t => t.output == deviceIndex);
					if (!timer) return false;

					// Determine Timezone
					const tz = (settings.timezones && settings.timezones[deviceIndex]) ? settings.timezones[deviceIndex] : "UTC";

					// Get "Current Time" relative to that timezone
					// We use Intl to shift the server time to the target timezone
					const nowServer = new Date();
					let deviceTimeStr;
					try {
						deviceTimeStr = nowServer.toLocaleString("en-US", { timeZone: tz, hour12: false });
					} catch(e) {
						// Fallback if invalid TZ
						deviceTimeStr = nowServer.toLocaleString("en-US", { timeZone: "UTC", hour12: false });
					}
					
					const deviceDate = new Date(deviceTimeStr);
					const currentDay = deviceDate.getDay(); // 0-6 relative to TZ
					const currentHour = deviceDate.getHours();
					const currentMin = deviceDate.getMinutes();
					const currentTimeVal = (currentHour * 60) + currentMin;

					// Check Day
					if (!timer.days[currentDay]) return false;

					// Extract stored HH:MM
					const tStart = new Date(timer.starttime);
					const tEnd = new Date(timer.endtime);
					const startVal = (tStart.getHours() * 60) + tStart.getMinutes();
					const endVal = (tEnd.getHours() * 60) + tEnd.getMinutes();

					// Check Time
					if (startVal < endVal) {
						// Standard range (e.g., 08:00 to 17:00)
						return currentTimeVal >= startVal && currentTimeVal < endVal;
					} else {
						// Overnight range (e.g., 22:00 to 06:00)
						// Be careful with day checks on overnight, simplified here to:
						// If active today, it runs until midnight.
						// If active yesterday, it runs from midnight.
						// (Keeping strictly to current Day check for simplicity based on prompt)
						return currentTimeVal >= startVal || currentTimeVal < endVal;
					}
				}

				function getNodeData() {
					return { timers: getTimers(), settings: getSettings() };
				}

				node.nodeCallback = function nodeCallback(req, res) {
					res.send(getNodeData());
				}

				node.on("close", function() {
					if (nodeInterval) clearInterval(nodeInterval);
				});
			}
		} catch (error) {
			console.log("TimeSchedulerNode:", error);
		}
	}
	RED.nodes.registerType("ui_time_scheduler", TimeSchedulerNode);

	let uiPath = ((RED.settings.ui || {}).path);
	if (uiPath == undefined) uiPath = 'ui';
	let nodePath = '/' + uiPath + '/time-scheduler/getNode/:nodeId';
	nodePath = nodePath.replace(/\/+/g, '/');

	RED.httpNode.get(nodePath, function(req, res) {
		const nodeId = req.params.nodeId;
		const node = RED.nodes.getNode(nodeId);
		node ? node.nodeCallback(req, res) : res.send(404).end();
	});
}
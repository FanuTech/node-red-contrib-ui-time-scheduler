/*
MIT License

Copyright (c) 2020 Mario Fellinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

module.exports = function(RED) {
	'use strict';
	const sunCalc = require('suncalc');

		function HTML(config) {
		const uniqueId = config.id.replace(".", "");
		const divPrimary = "ui-ts-" + uniqueId;

		const styles = String.raw`
		<style>
			#${divPrimary} {
				padding-left: 6px;
				padding-right: 7px;
			}
			#${divPrimary} md-input-container {
				width: 100%;
			}
			#${divPrimary} md-select md-select-value {
				color: var(--nr-dashboard-widgetTextColor);
				border-color: var(--nr-dashboard-widgetColor);
			}
			#${divPrimary} md-select[disabled] md-select-value, input[type="text"]:disabled {
				color: var(--nr-dashboard-widgetTextColor);
				opacity: 0.7;
			}
			#${divPrimary} .md-button {
				color: var(--nr-dashboard-widgetTextColor);
				background-color: var(--nr-dashboard-widgetColor);
				min-width: 40px;
			}
			#${divPrimary} .md-subheader {
				top: -3px !important;
			}
			#${divPrimary} .md-subheader .md-subheader-inner {
				color: var(--nr-dashboard-widgetTextColor);
				background-color: var(--nr-dashboard-widgetColor);
				padding: 6px 5px;
			}
			#${divPrimary} md-icon {
				color: var(--nr-dashboard-widgetTextColor);
			}
			#${divPrimary} md-progress-circular path {
				stroke: var(--nr-dashboard-widgetTextColor);
			}
			#${divPrimary} .weekDay {
				color: var(--nr-dashboard-widgetTextColor);
				background-color: var(--nr-dashboard-widgetColor);
				width: 34px;
				line-height: 34px;
				display: inline-block;
				border-radius: 50%;
				opacity: 0.4;
			}
			#${divPrimary} .weekDayActive {
				opacity: 1;
			}
		</style>
		`;

		const timerBody = String.raw`
		<div id="${divPrimary}" ng-init='init(${JSON.stringify(config)})'>
			<div id="deviceListView-${uniqueId}">
				<md-list flex ng-cloak>
					<md-subheader>
					<div class="md-subhead" style="text-align:center;">Schedules</div>
					</md-subheader>

					<md-list-item class="md-2-line" ng-repeat="device in devices track by $index" style="min-height: 72px; padding: 0 5px;">
						<div class="md-list-item-text" layout="column" style="width:100%; opacity:{{isDeviceEnabled($index) ? 1 : 0.4}};">
							<div layout="row" layout-align="space-between center">
								<div flex="38" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{device.name}}</div>

								<div flex="24" layout="row" layout-align="center center">
									<md-input-container style="margin:0; width: 110px;">
										<md-select class="nr-dashboard-dropdown" aria-label="Time Zone" ng-model="deviceTimezones[$index]" ng-change="saveSettings()" ng-disabled="isEditMode">
											<md-option ng-repeat="tz in tzOptions" value="{{tz.value}}">{{tz.label}}</md-option>
										</md-select>
									</md-input-container>
								</div>

								<div flex="26" style="text-align:center;">
									<div ng-if="getTimerForDevice($index)">
										<div>{{scheduleLabel($index)}}</div>
										<div style="font-size: 0.75em; opacity: 0.85;">{{daysLabel($index)}}</div>
									</div>
									<div ng-if="!getTimerForDevice($index)" style="opacity:0.8;">No schedule</div>
								</div>

								<div flex="12" layout="row" layout-align="end center">
									<md-button style="width: 40px; height: 36px; margin: 0 4px 0 0;" aria-label="device enabled" ng-click="toggleDeviceStatus($index)" ng-disabled="isEditMode">
										<md-icon> {{isDeviceEnabled($index) ? "alarm_on" : "alarm_off"}} </md-icon>
									</md-button>
									<md-button style="width: 40px; height: 36px; margin: 0px;" aria-label="edit schedule" ng-click="editDevice($index)" ng-disabled="loading">
										<md-icon> edit </md-icon>
									</md-button>
								</div>
							</div>
						</div>
						<md-divider ng-if="!$last"></md-divider>
					</md-list-item>
				</md-list>
			</div>

			<div id="addTimerView-${uniqueId}" style="display:none; position: relative;">
				<div layout="row" layout-align="space-between center" style="max-height: 50px;">
					<span flex="70" style="height:50px; line-height: 50px;"> {{devices[editDeviceIndex].name}} </span>
					<span flex="30" layout="row" layout-align="end center" style="height: 50px;">
						<md-button style="width: 40px; height: 36px; margin: 0px;" aria-label="Close" ng-click="cancelEdit()" ng-disabled="loading">
							<md-icon> close </md-icon>
						</md-button>
					</span>
				</div>

				<form ng-submit="addTimer()" style="width: 100%; position: absolute;">
					<div ng-show="!showSunSettings">
						<div layout="row" layout-align="space-between none" style="max-height: 60px;">
							<md-input-container flex="50" ng-show="formtimer.starttype === 'custom'" style="margin-left: 0">
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.starttime")}</label>
								<input id="timerStarttime-${uniqueId}" value="08:00" type="time" required pattern="^([0-1][0-9]|2[0-3]):([0-5][0-9])$">
								<span class="validity"></span>
							</md-input-container>
							<md-input-container flex="50" ng-if="formtimer.starttype !== 'custom'" style="margin-left: 0">
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.starttime")}</label>
								<input ng-model="formtimer.solarStarttimeLabel" type="text" required disabled>
								<span class="validity"></span>
							</md-input-container>
							${config.eventMode ? `
							<md-input-container flex="">
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.event")}</label>
								${config.customPayload ? `
								<input ng-model="formtimer.timerEvent" required autocomplete="off">
								` : `
								<md-select class="nr-dashboard-dropdown" ng-model="formtimer.timerEvent" required>
									<md-option ng-repeat="option in eventOptions" value={{option.event}}> {{option.label}} </md-option>
								</md-select>
								`}
							</md-input-container>
							` : `
							<md-input-container flex="50" ng-show="formtimer.endtype === 'custom'">
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.endtime")}</label>
								<input id="timerEndtime-${uniqueId}" value="10:00" type="time" required pattern="^([0-1][0-9]|2[0-3]):([0-5][0-9])$">
								<span class="validity"></span>
							</md-input-container>
							<md-input-container flex="50" ng-if="formtimer.endtype !== 'custom'">
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.endtime")}</label>
								<input ng-model="formtimer.solarEndtimeLabel" type="text" required disabled> </input>
								<span class="validity"></span>
							</md-input-container>
							`}
						</div>
						<div layout="row" style="max-height: 50px;">
							<md-input-container>
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.daysActive")}</label>
								<md-select class="nr-dashboard-dropdown" multiple="true" placeholder="${RED._("time-scheduler.ui.daysActive")}" ng-model="formtimer.dayselect" ng-change="daysChanged()" >
									<md-option value="all"><em>${RED._("time-scheduler.ui.selectAll")}</em></md-option>
									<md-option ng-repeat="day in days | limitTo : ${config.startDay}-7" ng-init="$index=$index+${config.startDay}" value={{$index}}> {{days[$index]}} </md-option>
									<md-option ng-repeat="day in days | limitTo : -${config.startDay}" value={{$index}}> {{days[$index]}} </md-option>
								</md-select>
							</md-input-container>
						</div>
						<div layout="row" layout-align="space-between end" style="height: 40px;">
							<md-button style="margin: 1px;" ng-if="formtimer.index !== undefined" ng-click="deleteTimer()"> <md-icon> delete </md-icon> </md-button>
							<md-button style="margin: 1px;" ng-if="formtimer.index !== undefined" ng-click="formtimer.disabled=!formtimer.disabled">
								<md-icon> {{formtimer.disabled ? "alarm_off" : "alarm_on"}} </md-icon>
							</md-button>
							<span ng-if="formtimer.index === undefined" style="width: 40px;"></span> <span ng-if="formtimer.index === undefined" style="width: 40px;"></span>
							${config.solarEventsEnabled ? `<md-button style="margin: 1px;" aria-label="suntimer" ng-click="showSunSettings=!showSunSettings"> <md-icon> wb_sunny </md-icon> </md-button>` : ``}
							<md-button style="margin: 1px" type="submit"> <md-icon> done </md-icon> </md-button>
						</div>
					</div>

					<div ng-show="showSunSettings">
						<div layout="row" style="height: 50px;">
							<md-input-container flex="55">
								<label style="color: var(--nr-dashboard-widgetTextColor)">Starttype</label>
								<md-select class="nr-dashboard-dropdown" ng-model="formtimer.starttype" ng-change="updateSolarLabels()">
									<md-option value="custom" selected> ${RED._("time-scheduler.ui.custom")} </md-option>
									<md-option value="sunrise"> ${RED._("time-scheduler.ui.sunrise")} </md-option>
									<md-option value="sunriseEnd"> ${RED._("time-scheduler.ui.sunriseEnd")} </md-option>
									<md-option value="goldenHourEnd"> ${RED._("time-scheduler.ui.goldenHourEnd")} </md-option>
									<md-option value="solarNoon"> ${RED._("time-scheduler.ui.solarNoon")} </md-option>
									<md-option value="goldenHour"> ${RED._("time-scheduler.ui.goldenHour")} </md-option>
									<md-option value="sunsetStart"> ${RED._("time-scheduler.ui.sunsetStart")} </md-option>
									<md-option value="sunset"> ${RED._("time-scheduler.ui.sunset")} </md-option>
									<md-option value="dusk"> ${RED._("time-scheduler.ui.dusk")} </md-option>
									<md-option value="nauticalDusk"> ${RED._("time-scheduler.ui.nauticalDusk")} </md-option>
									<md-option value="night"> ${RED._("time-scheduler.ui.night")} </md-option>
									<md-option value="nadir"> ${RED._("time-scheduler.ui.nadir")} </md-option>
									<md-option value="nightEnd"> ${RED._("time-scheduler.ui.nightEnd")} </md-option>
									<md-option value="nauticalDawn"> ${RED._("time-scheduler.ui.nauticalDawn")} </md-option>
									<md-option value="dawn"> ${RED._("time-scheduler.ui.dawn")} </md-option>
								</md-select>
							</md-input-container>
							<md-input-container flex="" ng-if="formtimer.starttype!='custom'">
								<label style="color: var(--nr-dashboard-widgetTextColor)">Offset (min)</label>
								<input type="number" ng-model="formtimer.startOffset" ng-change="offsetValidation('start')">
							</md-input-container>
						</div>

						<div layout="row" style="height: 50px;">
							<md-input-container flex="55" ng-if="!${config.eventMode}">
								<label style="color: var(--nr-dashboard-widgetTextColor)">Endtype</label>
								<md-select class="nr-dashboard-dropdown" ng-model="formtimer.endtype" ng-change="updateSolarLabels()">
									<md-option value="custom" selected> ${RED._("time-scheduler.ui.custom")} </md-option>
									<md-option value="sunrise"> ${RED._("time-scheduler.ui.sunrise")} </md-option>
									<md-option value="sunriseEnd"> ${RED._("time-scheduler.ui.sunriseEnd")} </md-option>
									<md-option value="goldenHourEnd"> ${RED._("time-scheduler.ui.goldenHourEnd")} </md-option>
									<md-option value="solarNoon"> ${RED._("time-scheduler.ui.solarNoon")} </md-option>
									<md-option value="goldenHour"> ${RED._("time-scheduler.ui.goldenHour")} </md-option>
									<md-option value="sunsetStart"> ${RED._("time-scheduler.ui.sunsetStart")} </md-option>
									<md-option value="sunset"> ${RED._("time-scheduler.ui.sunset")} </md-option>
									<md-option value="dusk"> ${RED._("time-scheduler.ui.dusk")} </md-option>
									<md-option value="nauticalDusk"> ${RED._("time-scheduler.ui.nauticalDusk")} </md-option>
									<md-option value="night"> ${RED._("time-scheduler.ui.night")} </md-option>
									<md-option value="nadir"> ${RED._("time-scheduler.ui.nadir")} </md-option>
									<md-option value="nightEnd"> ${RED._("time-scheduler.ui.nightEnd")} </md-option>
									<md-option value="nauticalDawn"> ${RED._("time-scheduler.ui.nauticalDawn")} </md-option>
									<md-option value="dawn"> ${RED._("time-scheduler.ui.dawn")} </md-option>
								</md-select>
							</md-input-container>
							<md-input-container flex="" ng-if="!${config.eventMode} && formtimer.endtype!='custom'">
								<label style="color: var(--nr-dashboard-widgetTextColor)">Offset (min)</label>
								<input type="number" ng-model="formtimer.endOffset" ng-change="offsetValidation('end')">
							</md-input-container>
						</div>

						<div layout="row" layout-align="space-between end" style="height: 50px;">
							<md-button style="margin: 1px;" aria-label="back" ng-click="showSunSettings=!showSunSettings"> <md-icon> arrow_back </md-icon> </md-button>
						</div>
					</div>
				</form>

				<div ng-show="loading" layout="row" layout-align="center center" style="width:100%; position: absolute; z-index:10; opacity: 0.9; height:150px; background-color: var(--nr-dashboard-widgetColor);">
					<md-progress-circular md-mode="indeterminate"></md-progress-circular>
				</div>
			</div>
		</div>
		`;

		return String.raw`${styles}${timerBody}`;
	}

	function checkConfig(config, node) {
		if (!config) {
			node.error(RED._("ui_time_scheduler.error.no-config"));
			return false;
		}
		if (!config.hasOwnProperty("group")) {
			node.error(RED._("ui_time_scheduler.error.no-group"));
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

			// START check props
			if (!config.hasOwnProperty("refresh")) config.refresh = 60;
			if (!config.hasOwnProperty("startDay")) config.startDay = 0;
			if (!config.hasOwnProperty("height") || config.height == 0) config.height = 1;
			if (!config.hasOwnProperty("name") || config.name === "") config.name = "Time-Scheduler";
			if (!config.hasOwnProperty("devices") || config.devices.length === 0) config.devices = [config.name];

			function normalizeDevicesConfig(devs, fallbackName) {
				const arr = Array.isArray(devs) ? devs : [];
				if (arr.length === 0) {
					const base = (fallbackName || "Device 1").toString();
					return [{ name: base, topic: base }];
				}
				return arr.map((d, i) => {
					if (typeof d === "string") {
						const s = (d || ("Device " + (i + 1))).toString();
						return { name: s, topic: s };
					}
					if (d && typeof d === "object") {
						const name = (d.name ?? d.label ?? d.device ?? "").toString() || ("Device " + (i + 1));
						const topicRaw = (d.topic ?? d.sendTopic ?? "").toString();
						const topic = topicRaw.trim() !== "" ? topicRaw : name;
						return { name, topic };
					}
					const s = ("Device " + (i + 1));
					return { name: s, topic: s };
				});
			}
			config.devices = normalizeDevicesConfig(config.devices, config.name);

			if (!config.hasOwnProperty("eventOptions")) config.eventOptions = [{ label: RED._("time-scheduler.label.on"), event: "true" }, { label: RED._("time-scheduler.label.off"), event: "false" }];
			
			// Customizable on/off commands (non-event mode)
			if (!config.hasOwnProperty("onPayload")) config.onPayload = "true";
			if (!config.hasOwnProperty("onPayloadType")) config.onPayloadType = "bool";
			if (!config.hasOwnProperty("offPayload")) config.offPayload = "false";
			if (!config.hasOwnProperty("offPayloadType")) config.offPayloadType = "bool";
            // Customizable message property names for device outputs
            if (!config.hasOwnProperty("nameProperty") || config.nameProperty === "") config.nameProperty = "topic";
            if (!config.hasOwnProperty("actionProperty") || config.actionProperty === "") config.actionProperty = "payload";
// END check props
			config.i18n = RED._("time-scheduler.ui", { returnObjects: true });
			config.solarEventsEnabled = ((config.lat !== "" && isFinite(config.lat) && Math.abs(config.lat) <= 90) && (config.lon !== "" && isFinite(config.lon) && Math.abs(config.lon) <= 180)) ? true : false;

			if (checkConfig(config, node)) {
				const done = ui.addWidget({
					node: node,
					format: HTML(config),
					templateScope: "local",
					group: config.group,
					width: config.width,
					height: Number(config.height) + 3,
					order: config.order,
					emitOnlyNewValues: false,
					forwardInputMessages: false,
					storeFrontEndInputAsState: true,
					persistantFrontEndValue: true,
					beforeEmit: function(msg, value) {
						if (msg.hasOwnProperty("disableDevice")) {
							if (addDisabledDevice(msg.disableDevice)) {
								node.status({ fill: "green", shape: "ring", text: msg.disableDevice + " " + RED._("time-scheduler.disabled") });
								msg.payload = serializeData();
								node.send(msg);
							}
						} else if (msg.hasOwnProperty("enableDevice")) {
							if (removeDisabledDevice(msg.enableDevice)) {
								node.status({ fill: "green", shape: "dot", text: msg.enableDevice + " " + RED._("time-scheduler.enabled") });
								msg.payload = serializeData();
								node.send(msg);
							}
						} else if (msg.hasOwnProperty("getStatus")) {
							msg.payload = serializeData();
							node.send(msg);
							return msg;
						} else {
							try {
								const parsedInput = JSON.parse(value);

								const parsedTimers = normalizeTimers(parsedInput.timers);
								if (validateTimers(parsedTimers)) {
									node.status({ fill: "green", shape: "dot", text: "time-scheduler.payloadReceived" });
									setTimers(parsedTimers);
								} else {
									node.status({ fill: "yellow", shape: "dot", text: "time-scheduler.invalidPayload" });
								}

								if (parsedInput.settings) setSettings(parsedInput.settings);
							} catch (e) {
								node.status({ fill: "red", shape: "dot", text: e.toString() });
							}
						}

						return { msg: [msg] };
					},
					beforeSend: function(msg, orig) {
						node.status({});
						if (orig && orig.msg[0]) {
							setTimers(orig.msg[0].payload.timers);
							setSettings(orig.msg[0].payload.settings);
							const sendMsg = JSON.parse(JSON.stringify(orig.msg));
							sendMsg[0].payload = serializeData();
							addOutputValues(sendMsg);
							return sendMsg;
						}
					},
										initController: function($scope) {
						const TZ_MAP = {
							PT: "America/Los_Angeles",
							MT: "America/Denver",
							CT: "America/Chicago",
							ET: "America/New_York",
							PST: "America/Los_Angeles",
							MST: "America/Denver",
							CST: "America/Chicago",
							EST: "America/New_York"
						};

						function toIanaTz(tzKey) {
							if (!tzKey) return TZ_MAP.PT;
							if (tzKey.includes("/")) return tzKey;
							return TZ_MAP[tzKey] || TZ_MAP.PT;
						}

						function timeStringToMinutes(hhmm) {
							if (!hhmm || typeof hhmm !== "string") return 0;
							const parts = hhmm.split(":");
							if (parts.length < 2) return 0;
							const h = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 0));
							const m = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
							return (h * 60) + m;
						}

						function minutesToTimeString(mins) {
							const m = ((mins % 1440) + 1440) % 1440;
							const h = Math.floor(m / 60);
							const mm = m % 60;
							return (h < 10 ? "0" + h : "" + h) + ":" + (mm < 10 ? "0" + mm : "" + mm);
						}

						function getNowInTimeZone(tzKey) {
							const tz = toIanaTz(tzKey);
							const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit" });
							const parts = dtf.formatToParts(new Date());
							const partObj = {};
							parts.forEach(p => partObj[p.type] = p.value);
							const hour = parseInt(partObj.hour || "0", 10);
							const minute = parseInt(partObj.minute || "0", 10);
							const weekday = partObj.weekday || "Sun";
							const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
							return { day: wdMap[weekday] ?? 0, hour, minute };
						}

						function ensureSingleSchedulePerDevice(timers) {
							if (!Array.isArray(timers)) return [];
							const map = {};
							// keep the LAST schedule we see for each device
							timers.forEach(t => {
								if (!t) return;
								const output = (Number.isInteger(t.output) ? t.output.toString() : (t.output ?? "0").toString());
								t.output = output;
								map[output] = t;
							});
							return Object.values(map).sort((a, b) => parseInt(a.output, 10) - parseInt(b.output, 10));
						}

						function normalizeTimers(timers) {
							if (!Array.isArray(timers)) return [];
							return timers.map(t => {
								if (!t) return t;
								if (Number.isInteger(t.output)) t.output = t.output.toString();
								if (!t.hasOwnProperty("days") || !Array.isArray(t.days) || t.days.length !== 7) t.days = [0, 0, 0, 0, 0, 0, 0];

								// Backwards compatibility: migrate starttime/endtime -> startMinutes/endMinutes if needed
								if (!t.hasOwnProperty("startMinutes") && t.hasOwnProperty("starttime")) {
									try {
										const d = new Date(t.starttime);
										t.startMinutes = (d.getHours() * 60) + d.getMinutes();
									} catch (e) { }
								}
								if (!t.hasOwnProperty("endMinutes") && t.hasOwnProperty("endtime")) {
									try {
										const d = new Date(t.endtime);
										t.endMinutes = (d.getHours() * 60) + d.getMinutes();
									} catch (e) { }
								}
								return t;
							});
						}

						$scope.init = function(config) {
							$scope.nodeId = config.id;
							$scope.i18n = config.i18n;
							$scope.days = config.i18n.days;
							function normalizeDevicesForUi(devs){
								const arr = Array.isArray(devs) ? devs : [];
								return arr.map((d,i)=>{
									if (typeof d === "string") return { name: d, topic: d };
									if (d && typeof d === "object") {
										const name = (d.name ?? d.label ?? d.device ?? "").toString() || ("Device " + (i+1));
										const topicRaw = (d.topic ?? "").toString();
										return { name, topic: (topicRaw.trim() !== "" ? topicRaw : name) };
									}
									return { name: "Device " + (i+1), topic: "Device " + (i+1) };
								});
							}
							$scope.devices = normalizeDevicesForUi(config.devices);
							$scope.eventMode = config.eventMode;
							$scope.eventOptions = config.eventOptions;

							$scope.tzOptions = [
								{ label: "PT", value: "PT" },
								{ label: "MT", value: "MT" },
								{ label: "CT", value: "CT" },
								{ label: "ET", value: "ET" }
							];

							$scope.timers = [];
							$scope.disabledDevices = [];
							$scope.deviceTimezones = [];
							for (let i = 0; i < $scope.devices.length; i++) $scope.deviceTimezones[i] = "PT";

							$scope.editDeviceIndex = 0;
							$scope.isEditMode = false;
							$scope.showSunSettings = false;

							$scope.showDeviceListView();
						}

						$scope.$watch('msg', function() {
							$scope.getTimersFromServer();
						});

						$scope.getElement = function(elementId) {
							return document.querySelector("#" + elementId + "-" + $scope.nodeId.replace(".", ""));
						}

						$scope.showDeviceListView = function() {
							$scope.isEditMode = false;
							$scope.getElement("deviceListView").style.display = "block";
							$scope.getElement("addTimerView").style.display = "none";
						}

						$scope.cancelEdit = function() {
							$scope.showDeviceListView();
						}

						$scope.getTimerIndexForDevice = function(deviceIndex) {
							if (!$scope.timers) return undefined;
							const idx = $scope.timers.findIndex(t => t && t.output == deviceIndex.toString());
							return idx >= 0 ? idx : undefined;
						}

						$scope.getTimerForDevice = function(deviceIndex) {
							if (!$scope.timers) return null;
							return $scope.timers.find(t => t && t.output == deviceIndex.toString()) || null;
						}

						$scope.daysLabel = function(deviceIndex) {
							const timer = $scope.getTimerForDevice(deviceIndex);
							if (!timer || !timer.days) return "";
							const active = [];
							for (let i = 0; i < 7; i++) {
								if (timer.days[i] === 1) active.push($scope.days[i].substring(0, 3));
							}
							if (active.length === 0) return "";
							if (active.length === 7) return "Every day";
							return active.join(" ");
						}

						$scope.scheduleLabel = function(deviceIndex) {
							const timer = $scope.getTimerForDevice(deviceIndex);
							if (!timer) return "";
							if ($scope.eventMode) {
								const t = minutesToTimeString(timer.startMinutes || 0);
								return t + " → " + $scope.eventToEventLabel(timer.event);
							} else {
								const start = minutesToTimeString(timer.startMinutes || 0);
								const end = minutesToTimeString(timer.endMinutes || 0);
								return start + " - " + end;
							}
						}

						$scope.editDevice = function(deviceIndex) {
							$scope.editDeviceIndex = deviceIndex;
							const idx = $scope.getTimerIndexForDevice(deviceIndex);
							$scope.showAddView(idx);
						}

						$scope.showAddView = function(timerIndex) {
							$scope.isEditMode = true;
							$scope.showSunSettings = false;

							$scope.getElement("deviceListView").style.display = "none";
							$scope.getElement("addTimerView").style.display = "block";

							$scope.formtimer = {
								index: timerIndex,
								dayselect: [],
								starttype: "custom",
								endtype: "custom",
							};

							const tzKey = $scope.deviceTimezones[$scope.editDeviceIndex] || "PT";
							const nowTz = getNowInTimeZone(tzKey);
							const defaultStart = (nowTz.hour * 60 + nowTz.minute + 1) % 1440;
							const defaultEnd = (defaultStart + 5) % 1440;

							if (timerIndex === undefined) {
								$scope.getElement("timerStarttime").value = minutesToTimeString(defaultStart);
								if ($scope.eventMode) $scope.formtimer.timerEvent = $scope.eventOptions.length > 0 ? $scope.eventOptions[0].event : "true";
								else $scope.getElement("timerEndtime").value = minutesToTimeString(defaultEnd);

								$scope.formtimer.dayselect.push(nowTz.day);
								$scope.formtimer.disabled = false;
							} else {
								const timer = $scope.timers[timerIndex];

								if (timer.hasOwnProperty("startSolarEvent")) $scope.formtimer.starttype = timer.startSolarEvent;
								if (timer.hasOwnProperty("startSolarOffset")) $scope.formtimer.startOffset = timer.startSolarOffset;

								if (!$scope.eventMode) {
									if (timer.hasOwnProperty("endSolarEvent")) $scope.formtimer.endtype = timer.endSolarEvent;
									if (timer.hasOwnProperty("endSolarOffset")) $scope.formtimer.endOffset = timer.endSolarOffset;
								}

								$scope.updateSolarLabels();

								if ($scope.formtimer.starttype === "custom") {
									$scope.getElement("timerStarttime").value = minutesToTimeString(timer.startMinutes || 0);
								}

								if ($scope.eventMode) {
									$scope.formtimer.timerEvent = timer.event;
								} else {
									if ($scope.formtimer.endtype === "custom") {
										$scope.getElement("timerEndtime").value = minutesToTimeString(timer.endMinutes || 0);
									}
								}

								for (let i = 0; i < 7; i++) {
									if (timer.days[i] === 1) $scope.formtimer.dayselect.push(i);
								}
								$scope.formtimer.disabled = timer.hasOwnProperty("disabled");
							}
						}

						$scope.addTimer = function() {
							const deviceIndex = $scope.editDeviceIndex;

							const timer = {
								days: [0, 0, 0, 0, 0, 0, 0],
								output: deviceIndex.toString()
							};

							if ($scope.formtimer.starttype !== "custom") {
								timer.startSolarEvent = $scope.formtimer.starttype;
								timer.startSolarOffset = $scope.formtimer.startOffset;
							} else {
								timer.startMinutes = timeStringToMinutes($scope.getElement("timerStarttime").value);
							}

							if ($scope.eventMode) {
								timer.event = $scope.formtimer.timerEvent;
								if (timer.event === "true" || timer.event === true) {
									timer.event = true;
								} else if (timer.event === "false" || timer.event === false) {
									timer.event = false;
								} else if (!isNaN(timer.event) && (timer.event === "0" || (timer.event + "").charAt(0) != "0")) {
									timer.event = Number(timer.event);
								}
							} else {
								if ($scope.formtimer.endtype !== "custom") {
									timer.endSolarEvent = $scope.formtimer.endtype;
									timer.endSolarOffset = $scope.formtimer.endOffset;
								} else {
									timer.endMinutes = timeStringToMinutes($scope.getElement("timerEndtime").value);
								}

								// Validate wrap-around
								if ($scope.formtimer.starttype === "custom" && $scope.formtimer.endtype === "custom") {
									const startM = timer.startMinutes;
									const endM = timer.endMinutes;
									if (endM <= startM) {
										if (!confirm($scope.i18n.alertTimespan)) return;
									}
								} else if ($scope.formtimer.starttype !== "custom" && $scope.formtimer.endtype !== "custom") {
									if (timer.startSolarEvent === timer.endSolarEvent && (timer.startSolarOffset || 0) >= (timer.endSolarOffset || 0)) {
										alert($scope.i18n.alertTimespanDay);
										return;
									}
								}
							}

							$scope.formtimer.dayselect.forEach(day => {
								const d = Number(day);
								if (!isNaN(d) && d >= 0 && d <= 6) timer.days[d] = 1;
							});

							if ($scope.formtimer.disabled) timer.disabled = "disabled";

							const existingIdx = $scope.getTimerIndexForDevice(deviceIndex);
							const timerIndex = $scope.formtimer.index;

							if (timerIndex === undefined) {
								if (existingIdx !== undefined) $scope.timers.splice(existingIdx, 1, timer);
								else $scope.timers.push(timer);
							} else {
								$scope.timers.splice(timerIndex, 1, timer);
							}

							$scope.sendTimersToOutput();
							$scope.cancelEdit();
						}

						$scope.deleteTimer = function() {
							const idx = $scope.getTimerIndexForDevice($scope.editDeviceIndex);
							if (idx !== undefined) {
								$scope.timers.splice(idx, 1);
								$scope.sendTimersToOutput();
							}
							$scope.cancelEdit();
						}

						$scope.saveSettings = function() {
							$scope.sendTimersToOutput(true);
						}

						$scope.sendTimersToOutput = function(skipEditClose) {
							if (!$scope.msg) $scope.msg = [{ payload: "" }];

							$scope.timers = ensureSingleSchedulePerDevice(normalizeTimers($scope.timers));

							$scope.msg[0].payload = {
								timers: angular.copy($scope.timers),
								settings: {
									disabledDevices: angular.copy($scope.disabledDevices),
									deviceTimezones: angular.copy($scope.deviceTimezones)
								}
							};
							$scope.send([$scope.msg[0]]);
						}

						$scope.daysChanged = function() {
							if ($scope.formtimer.dayselect.length === 8) {
								$scope.formtimer.dayselect = [];
							} else if ($scope.formtimer.dayselect.includes('all')) {
								$scope.formtimer.dayselect = [0, 1, 2, 3, 4, 5, 6];
							};
						}

						$scope.eventToEventLabel = function(event) {
							const option = $scope.eventOptions.find(o => { return o.event === event.toString() });
							return option ? option.label : event;
						}

						$scope.updateSolarLabels = function() {
							const startOffset = $scope.formtimer.startOffset > 0 ? "+" + $scope.formtimer.startOffset : ($scope.formtimer.startOffset || 0);
							const startTypeLabel = startOffset === 0 ? $scope.i18n[$scope.formtimer.starttype] : $scope.i18n[$scope.formtimer.starttype].substr(0, 8);
							$scope.formtimer.solarStarttimeLabel = startTypeLabel + (startOffset != 0 ? " " + startOffset + "m" : "");
							const endOffset = $scope.formtimer.endOffset > 0 ? "+" + $scope.formtimer.endOffset : ($scope.formtimer.endOffset || 0);
							const endTypeLabel = endOffset === 0 ? $scope.i18n[$scope.formtimer.endtype] : $scope.i18n[$scope.formtimer.endtype].substr(0, 8);
							$scope.formtimer.solarEndtimeLabel = endTypeLabel + (endOffset != 0 ? " " + endOffset + "m" : "");
						}

						$scope.offsetValidation = function(type) {
							if (type === "start") {
								if ($scope.formtimer.startOffset > 300) $scope.formtimer.startOffset = 300;
								if ($scope.formtimer.startOffset < -300) $scope.formtimer.startOffset = -300;
							} else if (type === "end") {
								if ($scope.formtimer.endOffset > 300) $scope.formtimer.endOffset = 300;
								if ($scope.formtimer.endOffset < -300) $scope.formtimer.endOffset = -300;
							}
							$scope.updateSolarLabels();
						}

						$scope.toggleDeviceStatus = function(deviceIndex) {
							if ($scope.isDeviceEnabled(deviceIndex)) {
								$scope.disabledDevices = $scope.disabledDevices || [];
								$scope.disabledDevices.push(deviceIndex.toString());
							} else {
								$scope.disabledDevices.splice($scope.disabledDevices.indexOf(deviceIndex.toString()), 1);
							}
							$scope.sendTimersToOutput(true);
						}

						$scope.isDeviceEnabled = function(deviceIndex) {
							const disabledDevices = $scope.disabledDevices || [];
							return !disabledDevices.includes(deviceIndex.toString());
						}

						$scope.getTimersFromServer = function() {
							$.ajax({
								url: "time-scheduler/getNode/" + $scope.nodeId, dataType: 'json',
								beforeSend: function() {
									$scope.loading = true;
								},
								success: function(json) {
									$scope.timers = ensureSingleSchedulePerDevice(normalizeTimers(json.timers || []));
									$scope.disabledDevices = (json.settings && json.settings.disabledDevices) ? json.settings.disabledDevices : [];
									$scope.deviceTimezones = (json.settings && json.settings.deviceTimezones) ? json.settings.deviceTimezones : [];

									for (let i = 0; i < $scope.devices.length; i++) {
										if (!$scope.deviceTimezones[i]) $scope.deviceTimezones[i] = "PT";
									}

									$scope.$digest();
								},
								complete: function() {
									$scope.loading = false;
									if (!$scope.isEditMode) $scope.showDeviceListView();
									$scope.$digest();
								}
							});
						}
					}
				});

				let nodeInterval;
				let prevPayloadFp = [];


				function parseTypedValue(value, type) {
					const t = (type || "str").toString();
					if (t === "num") return Number(value);
					if (t === "bool") return (value === true || value === "true" || value === 1 || value === "1");
					if (t === "json") {
						if (value === "" || value === undefined || value === null) return {};
						try { return JSON.parse(value); } catch (e) { node.warn("Invalid JSON for on/off payload: " + e.toString()); return value; }
					}
					return (value !== undefined && value !== null) ? value : "";
				}

				function clonePayload(v) {
					if (v && typeof v === "object") {
						try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
					}
					return v;
				}

				function payloadFingerprint(v) {
					if (v === undefined) return "u";
					if (v === null) return "n";
					const t = typeof v;
					if (t === "object") {
						try { return "o:" + JSON.stringify(v); } catch (e) { return "o:[unstringifiable]"; }
					}
					return t + ":" + String(v);
				}

				const onCommandValue = parseTypedValue(config.onPayload, config.onPayloadType);
				const offCommandValue = parseTypedValue(config.offPayload, config.offPayloadType);

				(() => {
					let timers = normalizeTimers(getContextValue('timers'));
					if (validateTimers(timers)) {
						node.status({});
					} else {
						node.status({ fill: "green", shape: "dot", text: "time-scheduler.contextCreated" });
						timers = [];
					}
					setTimers(timers);
					createInitTimeout();
				})();

								function validateTimers(timers) {
					return Array.isArray(timers) && timers.every(t => {
						if (!t) return false;

						// output is always a string index
						if (!t.hasOwnProperty("output")) t.output = "0";
						else if (Number.isInteger(t.output)) t.output = t.output.toString();
						else t.output = (t.output ?? "0").toString();

						// days must be an array[7]
						if (!t.hasOwnProperty("days") || !Array.isArray(t.days) || t.days.length !== 7) return false;

						// schedule fields (new schema: startMinutes/endMinutes, legacy: starttime/endtime)
						const hasStart = t.hasOwnProperty("startMinutes") || t.hasOwnProperty("startSolarEvent") || t.hasOwnProperty("starttime");
						if (!hasStart) return false;

						if (config.eventMode) {
							if (!t.hasOwnProperty("event")) return false;
						} else {
							const hasEnd = t.hasOwnProperty("endMinutes") || t.hasOwnProperty("endSolarEvent") || t.hasOwnProperty("endtime");
							if (!hasEnd) return false;
						}

						return true;
					});
				}

				function normalizeTimers(timers) {
					if (!Array.isArray(timers)) return [];
					return timers.map(t => {
						if (!t) return t;
						if (Number.isInteger(t.output)) t.output = t.output.toString();
						if (!t.hasOwnProperty("output")) t.output = "0";
						t.output = (t.output ?? "0").toString();

						if (!t.hasOwnProperty("days") || !Array.isArray(t.days) || t.days.length !== 7) t.days = [0, 0, 0, 0, 0, 0, 0];

						// Backwards compatibility: migrate starttime/endtime -> startMinutes/endMinutes if needed
						if (!t.hasOwnProperty("startMinutes") && t.hasOwnProperty("starttime")) {
							try {
								const d = new Date(t.starttime);
								t.startMinutes = (d.getHours() * 60) + d.getMinutes();
							} catch (e) {}
						}
						if (!config.eventMode && !t.hasOwnProperty("endMinutes") && t.hasOwnProperty("endtime")) {
							try {
								const d = new Date(t.endtime);
								t.endMinutes = (d.getHours() * 60) + d.getMinutes();
							} catch (e) {}
						}
						return t;
					});
				}

				function ensureSingleSchedulePerDevice(timers) {
					if (!Array.isArray(timers)) return [];
					const map = {};
					timers.forEach(t => {
						if (!t) return;
						map[t.output] = t; // keep last
					});
					return Object.values(map).sort((a, b) => parseInt(a.output, 10) - parseInt(b.output, 10));
				}

				function getContextValue(key) {
					return config.customContextStore && RED.settings.contextStorage && RED.settings.contextStorage.hasOwnProperty(config.customContextStore) ?
						node.context().get(key, config.customContextStore) : node.context().get(key);
				}

				function setContextValue(key, value) {
					config.customContextStore && RED.settings.contextStorage && RED.settings.contextStorage.hasOwnProperty(config.customContextStore) ?
						node.context().set(key, value, config.customContextStore) : node.context().set(key, value);
				}

								function getTimers() {
					let timers = normalizeTimers(getContextValue('timers') || []);
					if (!validateTimers(timers)) timers = [];
					timers = timers.filter(t => Number(t.output) < config.devices.length);
					timers = ensureSingleSchedulePerDevice(timers);
					timers = updateSolarEvents(timers);
					return timers.sort((a, b) => (a.startMinutes || 0) - (b.startMinutes || 0));
				}

								function setTimers(timers) {
					let normalized = normalizeTimers(timers || []);
					normalized = normalized.filter(t => t && Number(t.output) < config.devices.length);
					normalized = ensureSingleSchedulePerDevice(normalized);
					setContextValue('timers', normalized);
				}

				function getSettings() {
					return getContextValue('settings') || {};
				}

				function setSettings(settings) {
					setContextValue('settings', settings);
				}

				// Per-device time zones (stored as shorthand keys like PT/MT/CT/ET in settings.deviceTimezones[])
				const TZ_MAP = {
					PT: "America/Los_Angeles",
					MT: "America/Denver",
					CT: "America/Chicago",
					ET: "America/New_York",
					PST: "America/Los_Angeles",
					MST: "America/Denver",
					CST: "America/Chicago",
					EST: "America/New_York"
				};

				function toIanaTz(tzKey) {
					if (!tzKey) return TZ_MAP.PT;
					if (typeof tzKey === "string" && tzKey.includes("/")) return tzKey;
					return TZ_MAP[tzKey] || TZ_MAP.PT;
				}

				function getDeviceTimezoneKey(deviceIndex) {
					const tzs = getSettings().deviceTimezones || [];
					return tzs[deviceIndex] || "PT";
				}

				function getDeviceTimezoneIana(deviceIndex) {
					return toIanaTz(getDeviceTimezoneKey(deviceIndex));
				}

				function getNowInTimeZone(tzIana) {
					const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tzIana, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit" });
					const parts = dtf.formatToParts(new Date());
					const partObj = {};
					parts.forEach(p => partObj[p.type] = p.value);
					const hour = parseInt(partObj.hour || "0", 10);
					const minute = parseInt(partObj.minute || "0", 10);
					const weekday = partObj.weekday || "Sun";
					const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
					return { day: wdMap[weekday] ?? 0, hour, minute, minutes: (hour * 60) + minute };
				}

				function dateToMinutesInTimeZone(dateObj, tzIana) {
					const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tzIana, hour12: false, hour: "2-digit", minute: "2-digit" });
					const parts = dtf.formatToParts(dateObj);
					const partObj = {};
					parts.forEach(p => partObj[p.type] = p.value);
					const hour = parseInt(partObj.hour || "0", 10);
					const minute = parseInt(partObj.minute || "0", 10);
					return (hour * 60) + minute;
				}

				function minutesDiff(startMinutes, endMinutes) {
					const s = ((startMinutes % 1440) + 1440) % 1440;
					const e = ((endMinutes % 1440) + 1440) % 1440;
					return (e - s + 1440) % 1440;
				}


				function getDisabledDevices() {
					return getSettings().disabledDevices || [];
				}

				function setDisabledDevices(disabledDevices) {
					setSettings({ ...getSettings(), disabledDevices });
				}


				function resolveDeviceIndex(device) {
					if (device === undefined || device === null) return -1;
					if (typeof device === "number") return device;
					if (typeof device === "string" && device.trim() !== "" && !isNaN(device)) return Number(device);
					if (typeof device === "object") device = device.name ?? device.topic ?? "";
					if (typeof device === "string") {
						return config.devices.findIndex(d => {
							if (!d) return false;
							if (typeof d === "string") return d === device;
							return d.name === device;
						});
					}
					return -1;
				}

				function addDisabledDevice(device) {
					const disabledDevices = getDisabledDevices();
					const deviceIndex = resolveDeviceIndex(device).toString();
					if (deviceIndex >= 0 && config.devices.length > deviceIndex && !disabledDevices.includes(deviceIndex)) {
						disabledDevices.push(deviceIndex);
						setDisabledDevices(disabledDevices);
						return true;
					}
					return false;
				}

				function removeDisabledDevice(device) {
					const disabledDevices = getDisabledDevices();
					const deviceIndex = resolveDeviceIndex(device).toString();
					if (deviceIndex >= 0 && config.devices.length > deviceIndex && disabledDevices.includes(deviceIndex)) {
						disabledDevices.splice(disabledDevices.indexOf(deviceIndex), 1);
						setDisabledDevices(disabledDevices);
						return true;
					}
					return false;
				}

				function createInitTimeout() {
					const today = new Date();
					const remaining = config.refresh - (today.getSeconds() % config.refresh);
					setTimeout(function() {
						nodeInterval = setInterval(intervalTimerFunction, config.refresh * 1000);
						intervalTimerFunction();
					}, (remaining * 1000) - today.getMilliseconds());
				}

				function intervalTimerFunction() {
					const outputValues = [null];
					addOutputValues(outputValues);
					node.send(outputValues);
				}


				function getDeviceName(i) {
					const d = config.devices[i];
					if (d && typeof d === "object") return (d.name ?? "").toString();
					return (d ?? "").toString();
				}
				function getDeviceTopic(i) {
					const d = config.devices[i];
					if (d && typeof d === "object") {
						const t = (d.topic ?? "").toString();
						if (t.trim() !== "") return t;
						const n = (d.name ?? "").toString();
						return n;
					}
					return (d ?? "").toString();
				}

				function normalizeMsgProp(p, fallback) {
					if (p === undefined || p === null) return fallback;
					let s = String(p).trim();
					if (!s) return fallback;
					if (s.startsWith("msg.")) s = s.slice(4);
					return s || fallback;
				}

				// Device-output message property names (e.g. msg.vmName / msg.actionId)
				const nameProp = normalizeMsgProp(config.nameProperty, "topic");
				const actionProp = normalizeMsgProp(config.actionProperty, "payload");

				function setMsgProp(msg, prop, value) {
					try {
						RED.util.setMessageProperty(msg, prop, value, true);
					} catch (e) {
						msg[prop] = value;
					}
				}

				function getMsgProp(msg, prop) {
					try {
						return RED.util.getMessageProperty(msg, prop);
					} catch (e) {
						return msg ? msg[prop] : undefined;
					}
				}

				function addOutputValues(outputValues) {
					for (let device = 0; device < config.devices.length; device++) {
						let status = isInTime(device);
						let payload = status;

						if (!config.eventMode) {
							if (status === true) payload = clonePayload(onCommandValue);
							else if (status === false) payload = clonePayload(offCommandValue);
							else payload = null;
						}

						if (payload === null || payload === undefined) {
							outputValues.push(null);
							continue;
						}

						const msg = {};
						setMsgProp(msg, actionProp, payload);
						if (config.sendTopic) setMsgProp(msg, nameProp, getDeviceTopic(device));
						outputValues.push(msg);
					}

					if (config.onlySendChange) removeUnchangedValues(outputValues);
				}

				function removeUnchangedValues(outputValues) {
					const currFp = [];
					for (let i = 1; i <= config.devices.length; i++) {
						const curr = outputValues[i];
						const v = curr ? getMsgProp(curr, actionProp) : null;
						const fp = curr ? payloadFingerprint(v) : null;
						currFp[i] = fp;
						if (curr && prevPayloadFp[i] && prevPayloadFp[i] === fp) {
							outputValues[i] = null;
						}
					}
					prevPayloadFp = currFp;
				}

								function isInTime(deviceIndex) {
					const nodeTimers = getTimers();
					let status = null;

					if (nodeTimers.length > 0 && !getDisabledDevices().includes(deviceIndex.toString())) {
						const tz = getDeviceTimezoneIana(deviceIndex);
						const now = getNowInTimeZone(tz);
						const today = now.day;
						const yesterday = today - 1 < 0 ? 6 : today - 1;
						const nowMin = now.minutes;

						nodeTimers.filter(timer => timer.output == deviceIndex.toString()).forEach(function(timer) {
							if (status != null) return;
							if (timer.hasOwnProperty("disabled")) return;
							if (!timer.days || timer.days.length !== 7) return;

							const startMin = (timer.startMinutes ?? 0);

							if (config.eventMode) {
								if (timer.days[today] !== 1) return;
								if (nowMin === startMin) {
									status = timer.event;
								}
								return;
							}

							const endMin = (timer.endMinutes ?? 0);

							if (endMin > startMin) {
								// same-day schedule
								if (timer.days[today] !== 1) return;
								if (nowMin >= startMin && nowMin < endMin) status = true;
							} else {
								// wraps around midnight OR is a 24h window (end == start means +24h)
								if (nowMin >= startMin) {
									if (timer.days[today] === 1) status = true;
								} else {
									const withinEndWindow = (endMin === startMin) ? true : (nowMin < endMin);
									if (withinEndWindow && timer.days[yesterday] === 1) status = true;
								}
							}
						});
					}

					if (!config.eventMode && !config.singleOff && status == null) status = false;
					return status;
				}

				



								function updateSolarEvents(timers) {
					if (config.solarEventsEnabled) {
						const sunTimes = sunCalc.getTimes(new Date(), config.lat, config.lon);
						return timers.map(t => {
							const deviceIndex = Number(t.output) || 0;
							const tz = getDeviceTimezoneIana(deviceIndex);

							if (t.hasOwnProperty("startSolarEvent")) {
								const offset = t.startSolarOffset || 0;
								const solarTime = sunTimes[t.startSolarEvent];
								if (solarTime instanceof Date && !isNaN(solarTime)) {
									const d = new Date(solarTime.getTime() + (offset * 60 * 1000));
									t.startMinutes = dateToMinutesInTimeZone(d, tz);
								}
							}

							if (!config.eventMode && t.hasOwnProperty("endSolarEvent")) {
								const offset = t.endSolarOffset || 0;
								const solarTime = sunTimes[t.endSolarEvent];
								if (solarTime instanceof Date && !isNaN(solarTime)) {
									const d = new Date(solarTime.getTime() + (offset * 60 * 1000));
									t.endMinutes = dateToMinutesInTimeZone(d, tz);
								}
							}

							return t;
						});
					} else {
						return timers.filter(t => !t.hasOwnProperty("startSolarEvent") && !t.hasOwnProperty("endSolarEvent"));
					}
				}

				function getNodeData() {
					return { timers: getTimers(), settings: getSettings() };
				}

				function serializeData() {
					return JSON.stringify(getNodeData());
				}

				node.nodeCallback = function nodeCallback(req, res) {
					res.send(getNodeData());
				}

				node.on("close", function() {
					if (nodeInterval) {
						clearInterval(nodeInterval);
					}
					if (done) {
						done();
					}
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
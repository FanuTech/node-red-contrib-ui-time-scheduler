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

			<div id="messageBoard-${uniqueId}" style="display:none;">
				<p></p>
			</div>

			<!-- OVERVIEW: always show all devices -->
			<div id="overview-${uniqueId}">
				<md-list flex ng-cloak>
					<md-subheader>
						<div layout="row" class="md-subhead" style="width:100%;">
							<span flex="35">${RED._("time-scheduler.label.devices")}</span>
							<span flex="35">${RED._("time-scheduler.label.deviceTimezone") || "Time zone"}</span>
							<span flex="20">${RED._("time-scheduler.ui.schedule") || "Schedule"}</span>
							<span flex="10" style="text-align:right;">&nbsp;</span>
						</div>
					</md-subheader>

					<md-list-item ng-repeat="device in devices track by $index" style="min-height: 58px; height: 58px; padding: 0 5px;">
						<div class="md-list-item-text" style="width:100%;">
							<div layout="row" layout-align="space-between center" style="width:100%;">
								<div flex="35" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
									{{devices[$index]}}
								</div>

								<div flex="35">
									<md-input-container style="margin: 0; width: 100%;">
										<md-select class="nr-dashboard-dropdown" ng-model="deviceTimezones[$index]" ng-change="saveSettings()" aria-label="Timezone">
											<md-option ng-repeat="tz in timezones" value="{{tz}}"> {{tz}} </md-option>
										</md-select>
									</md-input-container>
								</div>

								<div flex="20" style="font-size: 12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity: {{(getDeviceTimer($index) && (getDeviceTimer($index).disabled || !isDeviceEnabled($index))) ? 0.4 : 1}};">
									<span ng-if="getDeviceTimer($index)">{{formatTimerSummary(getDeviceTimer($index), $index)}}</span>
									<span ng-if="!getDeviceTimer($index)">${RED._("time-scheduler.ui.noSchedule") || "No schedule"}</span>
								</div>

								<div flex="10" layout="row" layout-align="end center">
									<md-button style="width: 40px; height: 36px; margin: 0 4px 0 0;" aria-label="device enabled" ng-click="toggleDeviceStatus($index)" ng-disabled="loading">
										<md-icon> {{isDeviceEnabled($index) ? "alarm_on" : "alarm_off"}} </md-icon>
									</md-button>
									<md-button style="width: 40px; height: 36px; margin: 0;" aria-label="edit" ng-click="openEdit($index)" ng-disabled="loading">
										<md-icon> edit </md-icon>
									</md-button>
								</div>
							</div>

							<!-- small day badges under summary (optional) -->
							<div ng-if="getDeviceTimer($index)" layout="row" style="padding-top: 2px;">
								<span flex="" ng-repeat="day in days | limitTo : ${config.startDay}-7" ng-init="dayIndex=$index+${config.startDay}">
									<span class="weekDay {{(getDeviceTimer($parent.$index).days[dayIndex]) ? 'weekDayActive' : ''}}"> {{days[dayIndex]}} </span>
								</span>
								<span flex="" ng-repeat="day in days | limitTo : -${config.startDay}" ng-init="dayIndex=$index">
									<span class="weekDay {{(getDeviceTimer($parent.$index).days[dayIndex]) ? 'weekDayActive' : ''}}"> {{days[dayIndex]}} </span>
								</span>
							</div>
						</div>
						<md-divider ng-if="!$last"></md-divider>
					</md-list-item>
				</md-list>
			</div>

			<!-- EDIT VIEW: one schedule per device -->
			<div id="editView-${uniqueId}" style="display:none; position: relative;">
				<form ng-submit="saveTimer()" style="width: 100%; position: relative;">
					<div layout="row" layout-align="space-between center" style="height: 46px;">
						<span style="line-height:46px; font-weight: 600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" flex="65">
							{{devices[editDeviceIndex]}} 
						</span>
						<span flex="35" style="text-align:right;">
							<md-button style="width: 40px; height: 36px; margin: 0 4px 0 0;" aria-label="close" ng-click="closeEdit()">
								<md-icon> close </md-icon>
							</md-button>
						</span>
					</div>

					<div layout="row" style="height: 50px;">
						<md-input-container flex="">
							<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.label.deviceTimezone") || "Time zone"}</label>
							<md-select class="nr-dashboard-dropdown" ng-model="deviceTimezones[editDeviceIndex]" ng-change="saveSettings()" required>
								<md-option ng-repeat="tz in timezones" value="{{tz}}"> {{tz}} </md-option>
							</md-select>
						</md-input-container>
					</div>

					<div ng-show="!showSunSettings">
						<div layout="row" layout-align="space-between none" style="max-height: 60px;">
							<md-input-container flex="50" ng-show="formtimer.starttype === 'custom'" style="margin-left: 0">
								<label style="color: var(--nr-dashboard-widgetTextColor)">${RED._("time-scheduler.ui.starttime")}</label>
								<input id="timerStarttime-${uniqueId}" type="time" required pattern="^([0-1][0-9]|2[0-3]):([0-5][0-9])$">
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
								<input id="timerEndtime-${uniqueId}" type="time" required pattern="^([0-1][0-9]|2[0-3]):([0-5][0-9])$">
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
								<md-select class="nr-dashboard-dropdown" multiple="true" placeholder="${RED._("time-scheduler.ui.daysActive")}" ng-model="formtimer.dayselect" ng-change="daysChanged()">
									<md-option value="all"><em>${RED._("time-scheduler.ui.selectAll")}</em></md-option>
									<md-option ng-repeat="day in days | limitTo : ${config.startDay}-7" ng-init="$index=$index+${config.startDay}" value={{$index}}> {{days[$index]}} </md-option>
									<md-option ng-repeat="day in days | limitTo : -${config.startDay}" value={{$index}}> {{days[$index]}} </md-option>
								</md-select>
							</md-input-container>
						</div>

						<div layout="row" layout-align="space-between end" style="height: 40px;">
							<md-button style="margin: 1px;" ng-if="hasExistingTimer(editDeviceIndex)" ng-click="deleteTimer()"> <md-icon> delete </md-icon> </md-button>
							<md-button style="margin: 1px;" ng-click="formtimer.disabled=!formtimer.disabled">
								<md-icon> {{formtimer.disabled ? "alarm_off" : "alarm_on"}} </md-icon>
							</md-button>
							${config.solarEventsEnabled ? `<md-button style="margin: 1px;" aria-label="suntimer" ng-click="showSunSettings=!showSunSettings"> <md-icon> wb_sunny </md-icon> </md-button>` : ``}
							<span flex=""></span>
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
							<md-button style="margin: 1px;" aria-label="suntimer" ng-click="showSunSettings=!showSunSettings"> <md-icon> arrow_back </md-icon> </md-button>
						</div>
					</div>
				</form>

				<div ng-show="loading" layout="row" layout-align="center center"
					style="width:100%; position: absolute; top: 0; left: 0; z-index:10; opacity: 0.9; height:150px; background-color: var(--nr-dashboard-widgetColor);">
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
			if (!config.hasOwnProperty("name") || config.name === "") config.name = "Time-Scheduler single";
			if (!config.hasOwnProperty("devices") || config.devices.length === 0) config.devices = [config.name];
			if (!config.hasOwnProperty("eventOptions")) config.eventOptions = [{ label: RED._("time-scheduler.label.on"), event: "true" }, { label: RED._("time-scheduler.label.off"), event: "false" }];
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

								const parsedTimers = parsedInput.timers;
								if (validateTimers(parsedTimers)) {
									node.status({ fill: "green", shape: "dot", text: "time-scheduler.payloadReceived" });
									setTimers(parsedTimers.filter(timer => timer.output < config.devices.length));
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
						$scope.init = function(config) {
							$scope.nodeId = config.id;
							$scope.i18n = config.i18n;
							$scope.days = config.i18n.days;
							$scope.devices = config.devices;
							$scope.eventMode = config.eventMode;
							$scope.eventOptions = config.eventOptions;

							$scope.loading = false;
							$scope.isEditMode = false;
							$scope.showSunSettings = false;
							$scope.editDeviceIndex = 0;

							const browserTz = (Intl && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") : "UTC";
							const tzList = [
								browserTz,
								"UTC",
								"America/Los_Angeles",
								"America/Denver",
								"America/Chicago",
								"America/New_York",
								"Europe/London",
								"Europe/Paris",
								"Asia/Tokyo",
								"Asia/Shanghai",
								"Australia/Sydney"
							].filter((v, i, a) => v && a.indexOf(v) === i);
							$scope.timezones = tzList;

							// one timezone per device
							$scope.deviceTimezones = {};
							for (let i = 0; i < $scope.devices.length; i++) $scope.deviceTimezones[i] = browserTz;
						}

						$scope.$watch('msg', function() {
							$scope.getTimersFromServer();
						});

						$scope.getElement = function(elementId) {
							return document.querySelector("#" + elementId + "-" + $scope.nodeId.replace(".", ""));
						}

						$scope.showOverview = function() {
							$scope.isEditMode = false;
							$scope.getElement("overview").style.display = "block";
							$scope.getElement("editView").style.display = "none";
							$scope.getElement("messageBoard").style.display = "none";

							if (!$scope.timers) {
								$scope.getElement("overview").style.display = "none";
								const msgBoard = $scope.getElement("messageBoard");
								msgBoard.style.display = "block";
								msgBoard.firstElementChild.innerHTML = $scope.i18n.payloadWarning;
							}
						}

						$scope.openEdit = function(deviceIndex) {
							$scope.isEditMode = true;
							$scope.showSunSettings = false;
							$scope.editDeviceIndex = deviceIndex;

							$scope.getElement("overview").style.display = "none";
							$scope.getElement("messageBoard").style.display = "none";
							$scope.getElement("editView").style.display = "block";

							$scope.formtimer = {
								dayselect: [],
								starttype: "custom",
								endtype: "custom",
								startOffset: 0,
								endOffset: 0,
								disabled: false
							};

							const timer = $scope.getDeviceTimer(deviceIndex);
							if (timer) {
								if (timer.hasOwnProperty("startSolarEvent")) $scope.formtimer.starttype = timer.startSolarEvent;
								if (timer.hasOwnProperty("startSolarOffset")) $scope.formtimer.startOffset = timer.startSolarOffset;
								if (timer.hasOwnProperty("endSolarEvent")) $scope.formtimer.endtype = timer.endSolarEvent;
								if (timer.hasOwnProperty("endSolarOffset")) $scope.formtimer.endOffset = timer.endSolarOffset;

								$scope.updateSolarLabels();

								if (timer.starttime) $scope.getElement("timerStarttime").value = timer.starttime;
								if (!$scope.eventMode && timer.endtime) $scope.getElement("timerEndtime").value = timer.endtime;
								if ($scope.eventMode) $scope.formtimer.timerEvent = timer.event;

								for (let i = 0; i < (timer.days || []).length; i++) {
									if (timer.days[i]) $scope.formtimer.dayselect.push(i);
								}
								$scope.formtimer.disabled = timer.hasOwnProperty("disabled");
							} else {
								// defaults
								const now = new Date();
								const hh = $scope.padZero(now.getHours());
								const mm = $scope.padZero(now.getMinutes());
								$scope.getElement("timerStarttime").value = `${hh}:${mm}`;
								if ($scope.eventMode) $scope.formtimer.timerEvent = $scope.eventOptions.length > 0 ? $scope.eventOptions[0].event : "true";
								else $scope.getElement("timerEndtime").value = `${hh}:${$scope.padZero((now.getMinutes() + 5) % 60)}`;
								$scope.formtimer.dayselect.push(now.getDay());
								$scope.formtimer.disabled = false;
							}
						}

						$scope.closeEdit = function() {
							$scope.showOverview();
						}

						$scope.getDeviceTimer = function(deviceIndex) {
							if (!$scope.timers) return null;
							return $scope.timers.find(t => t.output == deviceIndex.toString()) || null;
						}

						$scope.hasExistingTimer = function(deviceIndex) {
							return !!$scope.getDeviceTimer(deviceIndex);
						}

						$scope.formatTimerSummary = function(timer, deviceIndex) {
							if (!timer) return "";
							if ($scope.eventMode) {
								return `${timer.starttime || "--:--"} • ${$scope.eventToEventLabel(timer.event)}`;
							}
							return `${timer.starttime || "--:--"}-${timer.endtime || "--:--"}`;
						}

						$scope.saveTimer = function() {
							if (!$scope.timers) $scope.timers = [];

							const timer = {
								output: $scope.editDeviceIndex.toString(),
								days: [0, 0, 0, 0, 0, 0, 0]
							};

							// start time
							if ($scope.formtimer.starttype !== "custom") {
								timer.startSolarEvent = $scope.formtimer.starttype;
								timer.startSolarOffset = $scope.formtimer.startOffset;
							} else {
								timer.starttime = $scope.getElement("timerStarttime").value;
							}

							if ($scope.eventMode) {
								timer.event = $scope.formtimer.timerEvent;

								if (timer.event === "true" || timer.event === true) timer.event = true;
								else if (timer.event === "false" || timer.event === false) timer.event = false;
								else if (!isNaN(timer.event) && (timer.event === "0" || (timer.event + "").charAt(0) != "0")) timer.event = Number(timer.event);
							} else {
								if ($scope.formtimer.endtype !== "custom") {
									timer.endSolarEvent = $scope.formtimer.endtype;
									timer.endSolarOffset = $scope.formtimer.endOffset;
								} else {
									timer.endtime = $scope.getElement("timerEndtime").value;
								}
							}

							$scope.formtimer.dayselect.forEach(day => {
								if (day === 'all') return;
								timer.days[Number(day)] = 1;
							});

							if ($scope.formtimer.disabled) timer.disabled = "disabled";

							// enforce ONLY ONE schedule per device
							$scope.timers = $scope.timers.filter(t => t.output != timer.output);
							$scope.timers.push(timer);

							$scope.sendTimersToOutput();
							$scope.showOverview();
						}

						$scope.deleteTimer = function() {
							if (!$scope.timers) return;
							$scope.timers = $scope.timers.filter(t => t.output != $scope.editDeviceIndex.toString());
							$scope.sendTimersToOutput();
							$scope.showOverview();
						}

						$scope.saveSettings = function() {
							$scope.sendTimersToOutput();
						}

						$scope.sendTimersToOutput = function() {
							if (!$scope.msg) $scope.msg = [{ payload: "" }];
							$scope.msg[0].payload = {
								timers: angular.copy($scope.timers || []),
								settings: {
									disabledDevices: angular.copy($scope.disabledDevices || []),
									deviceTimezones: angular.copy($scope.deviceTimezones || {})
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

						$scope.padZero = function(i) {
							return i < 10 ? "0" + i : i;
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
							$scope.sendTimersToOutput();
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
									$scope.timers = json.timers || [];
									$scope.disabledDevices = (json.settings && json.settings.disabledDevices) ? json.settings.disabledDevices : [];
									$scope.deviceTimezones = (json.settings && json.settings.deviceTimezones) ? json.settings.deviceTimezones : $scope.deviceTimezones;
									$scope.$digest();
								},
								complete: function() {
									$scope.loading = false;
									$scope.showOverview();
									$scope.$digest();
								}
							});
						}
					}

				});

				let nodeInterval;
				let prevMsg = [];

				(() => {
					let timers = getContextValue('timers');
					if (validateTimers(timers)) {
						node.status({});
						timers = timers.filter(timer => timer.output < config.devices.length);
					} else {
						node.status({ fill: "green", shape: "dot", text: "time-scheduler.contextCreated" });
						timers = [];
					}
					setTimers(timers);
					createInitTimeout();
				})();

				function validateTimers(timers) {
					return Array.isArray(timers) && timers.every(element => {
						// output index
						if (!element.hasOwnProperty("output")) element.output = "0";
						else if (Number.isInteger(element.output)) element.output = element.output.toString();
						else element.output = (element.output + "");

						// days
						if (!Array.isArray(element.days) || element.days.length !== 7) {
							element.days = [0, 0, 0, 0, 0, 0, 0];
						}

						// start time can be "HH:MM" (preferred) OR millis OR solar event
						const hasStart = element.hasOwnProperty("starttime") || element.hasOwnProperty("startSolarEvent");
						if (!hasStart) return false;

						if (!config.eventMode) {
							// end time can be "HH:MM" (preferred) OR millis OR solar event
							const hasEnd = element.hasOwnProperty("endtime") || element.hasOwnProperty("endSolarEvent");
							if (!hasEnd) return false;
						} else {
							if (!element.hasOwnProperty("event")) return false;
						}

						return true;
					});
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
					const timers = getContextValue('timers') || [];
					return updateSolarEvents(timers).sort(function(a, b) {
						const aMin = parseTimeToMinutes(a.starttime) ?? 0;
						const bMin = parseTimeToMinutes(b.starttime) ?? 0;
						return aMin - bMin;
					});
				}

				function setTimers(timers) {
					// enforce: max 1 schedule per device (keep last encountered)
					const byOutput = {};
					(timers || []).forEach(t => {
						if (t && t.output !== undefined) byOutput[t.output.toString()] = t;
					});
					const uniqueTimers = Object.keys(byOutput).map(k => byOutput[k]);

					// clamp outputs to configured devices length
					const clamped = uniqueTimers.filter(timer => Number(timer.output) < config.devices.length);

					setContextValue('timers', clamped);
				}

				function getSettings() {
					return getContextValue('settings') || {};
				}

				function setSettings(settings) {
					setContextValue('settings', settings);
				}

				function getDisabledDevices() {
					return getSettings().disabledDevices || [];
				}

				function setDisabledDevices(disabledDevices) {
					setSettings({ ...getSettings(), disabledDevices });
				}

				function addDisabledDevice(device) {
					const disabledDevices = getDisabledDevices();
					const deviceIndex = (isNaN(device) ? config.devices.indexOf(device) : device).toString();
					if (deviceIndex >= 0 && config.devices.length > deviceIndex && !disabledDevices.includes(deviceIndex)) {
						disabledDevices.push(deviceIndex);
						setDisabledDevices(disabledDevices);
						return true;
					}
					return false;
				}

				function removeDisabledDevice(device) {
					const disabledDevices = getDisabledDevices();
					const deviceIndex = (isNaN(device) ? config.devices.indexOf(device) : device).toString();
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

				function addOutputValues(outputValues) {
					for (let device = 0; device < config.devices.length; device++) {
						const msg = { payload: isInTime(device) };
						if (config.sendTopic) msg.topic = config.devices[device];
						msg.payload != null ? outputValues.push(msg) : outputValues.push(null);
					}
					if (config.onlySendChange) removeUnchangedValues(outputValues);
				}

				function removeUnchangedValues(outputValues) {
					const currMsg = JSON.parse(JSON.stringify(outputValues));
					for (let i = 1; i <= config.devices.length; i++) {
						if (prevMsg[i] && currMsg[i] && (prevMsg[i].payload === currMsg[i].payload)) {
							outputValues[i] = null;
						}
					}
					prevMsg = currMsg;
				}

				function parseTimeToMinutes(v) {
					if (v === undefined || v === null) return null;
					if (typeof v === "number") {
						const d = new Date(v);
						return (d.getHours() * 60) + d.getMinutes();
					}
					if (typeof v === "string") {
						const m = v.match(/^(\d{1,2}):(\d{2})$/);
						if (!m) return null;
						const hh = Number(m[1]); const mm = Number(m[2]);
						if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
						return (hh * 60) + mm;
					}
					return null;
				}

				function getNowInTimezone(tz) {
					const date = new Date();
					try {
						const parts = new Intl.DateTimeFormat('en-US', {
							timeZone: tz || "UTC",
							weekday: 'short',
							hour: '2-digit',
							minute: '2-digit',
							hourCycle: 'h23'
						}).formatToParts(date);

						let wk = "Sun", hh = "00", mm = "00";
						parts.forEach(p => {
							if (p.type === "weekday") wk = p.value;
							if (p.type === "hour") hh = p.value;
							if (p.type === "minute") mm = p.value;
						});

						const weekMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
						return { day: weekMap[wk] ?? date.getDay(), minutes: (Number(hh) * 60) + Number(mm) };
					} catch (e) {
						// fallback to server local timezone
						return { day: date.getDay(), minutes: (date.getHours() * 60) + date.getMinutes() };
					}
				}

				function getDeviceTimezone(deviceIndex) {
					const settings = getSettings();
					const map = settings.deviceTimezones || {};
					return map[deviceIndex] || map[deviceIndex.toString()] || (Intl && Intl.DateTimeFormat ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") : "UTC");
				}

				function isInTime(deviceIndex) {
					const nodeTimers = getTimers();
					let status = null;

					if (nodeTimers.length > 0 && !getDisabledDevices().includes(deviceIndex.toString())) {
						const tz = getDeviceTimezone(deviceIndex);
						const now = getNowInTimezone(tz);
						const timer = nodeTimers.find(t => t.output == deviceIndex.toString());

						if (timer && !timer.hasOwnProperty("disabled") && Array.isArray(timer.days) && timer.days[now.day] === 1) {
							// compute start/end in minutes within the device timezone
							const startMin = parseTimeToMinutes(timer.starttime);
							const endMin = config.eventMode ? null : parseTimeToMinutes(timer.endtime);

							if (config.eventMode) {
								if (startMin !== null && now.minutes === startMin) {
									status = timer.event;
								}
							} else {
								if (startMin !== null && endMin !== null) {
									const wraps = startMin > endMin;
									const inRange = wraps ? (now.minutes >= startMin || now.minutes < endMin) : (now.minutes >= startMin && now.minutes < endMin);
									if (inRange) status = true;
									else if (now.minutes === endMin) status = false;
								}
							}
						}
					}

					if (!config.eventMode && !config.singleOff && status == null) status = false;
					return status;
				}

				function localDayToUtc(timer, localDay) {
					const start = new Date(timer.starttime);
					let shift = start.getUTCDay() - start.getDay();
					if (shift < -1) shift = 1;
					if (shift > 1) shift = -1;
					let utcDay = shift + localDay;
					if (utcDay < 0) utcDay = 6;
					if (utcDay > 6) utcDay = 0;
					return utcDay;
				}

				function getNowWithCustomTime(timeInMillis) {
					const date = new Date();
					const origDate = new Date(timeInMillis);
					date.setHours(origDate.getHours());
					date.setMinutes(origDate.getMinutes());
					date.setSeconds(0); date.setMilliseconds(0);
					return date.getTime();
				}

				function updateSolarEvents(timers) {
					// Convert solar event fields into "HH:MM" strings in the device timezone (so UI + runtime stay consistent).
					function toHHMM(dateObj, tz) {
						try {
							const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || "UTC", hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dateObj);
							let hh = "00", mm = "00";
							parts.forEach(p => { if (p.type === "hour") hh = p.value; if (p.type === "minute") mm = p.value; });
							return `${hh}:${mm}`;
						} catch (e) {
							const d = new Date(dateObj);
							return `${("0" + d.getHours()).slice(-2)}:${("0" + d.getMinutes()).slice(-2)}`;
						}
					}

					if (config.solarEventsEnabled) {
						const sunTimes = sunCalc.getTimes(new Date(), config.lat, config.lon);
						return (timers || []).map(t => {
							const tz = getDeviceTimezone(Number(t.output || 0));

							if (t.hasOwnProperty("startSolarEvent")) {
								const offset = t.startSolarOffset || 0;
								const solarTime = sunTimes[t.startSolarEvent];
								const shifted = new Date(solarTime.getTime() + (offset * 60 * 1000));
								t.starttime = toHHMM(shifted, tz);
							}
							if (t.hasOwnProperty("endSolarEvent")) {
								const offset = t.endSolarOffset || 0;
								const solarTime = sunTimes[t.endSolarEvent];
								const shifted = new Date(solarTime.getTime() + (offset * 60 * 1000));
								t.endtime = toHHMM(shifted, tz);
							}

							// If legacy numeric millis exist, keep but prefer HH:MM for runtime/UI
							if (typeof t.starttime === "number") t.starttime = toHHMM(new Date(t.starttime), tz);
							if (typeof t.endtime === "number") t.endtime = toHHMM(new Date(t.endtime), tz);

							return t;
						});
					} else {
						// if solar is disabled, drop timers that rely on solar fields
						return (timers || []).filter(t => !t.hasOwnProperty("startSolarEvent") && !t.hasOwnProperty("endSolarEvent"));
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
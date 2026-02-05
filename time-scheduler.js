/*
MIT License
Copyright (c) 2020 Mario Fellinger
Modified for Fanu Tech: Single Schedule per Device enforcement.
*/

module.exports = function(RED) {
	'use strict';
	const sunCalc = require('suncalc');

	function HTML(config) {
		const uniqueId = config.id.replace(".", "");
		const divPrimary = "ui-ts-" + uniqueId;

		const styles = String.raw`
		<style>
			#${divPrimary} { padding-left: 6px; padding-right: 7px; }
			#${divPrimary} md-input-container { width: 100%; }
			#${divPrimary} md-select md-select-value { color: var(--nr-dashboard-widgetTextColor); border-color: var(--nr-dashboard-widgetColor); }
			#${divPrimary} .md-button { color: var(--nr-dashboard-widgetTextColor); background-color: var(--nr-dashboard-widgetColor); min-width: 40px; }
			#${divPrimary} .md-subheader .md-subheader-inner { color: var(--nr-dashboard-widgetTextColor); background-color: var(--nr-dashboard-widgetColor); padding: 6px 5px; }
			#${divPrimary} .weekDay { color: var(--nr-dashboard-widgetTextColor); background-color: var(--nr-dashboard-widgetColor); width: 34px; line-height: 34px; display: inline-block; border-radius: 50%; opacity: 0.4; text-align: center; }
			#${divPrimary} .weekDayActive { opacity: 1; font-weight: bold; }
		</style>
		`;

		const timerBody = String.raw`
		<div id="${divPrimary}" ng-init='init(${JSON.stringify(config)})'>
			<div layout="row" layout-align="space-between center" style="max-height: 50px;">
				<span flex="65" ng-show="devices.length <= 1" style="height:50px; line-height: 50px;"> ${config.devices[0]} </span>
				<span flex="65" ng-show="devices.length > 1">
					<md-input-container>
						<md-select class="nr-dashboard-dropdown" ng-model="myDeviceSelect" ng-change="showStandardView()" aria-label="Select device" ng-disabled="isEditMode">
							<md-option value="overview"> ${RED._("time-scheduler.ui.overview")} </md-option>
							<md-option ng-repeat="device in devices" value={{$index}}> {{devices[$index]}} </md-option>
						</md-select>
					</md-input-container>
				</span>
				<span flex="35" layout="row" layout-align="end center" style="height: 50px;">
					<md-button style="width: 40px; height: 36px; margin: 0px;" aria-label="Edit" ng-if="myDeviceSelect !== 'overview'" ng-click="toggleViews()" ng-disabled="loading">
						<md-icon> {{isEditMode ? "close" : ((timers | filter:{ output: myDeviceSelect }:true).length > 0 ? "edit" : "add")}} </md-icon>
					</md-button>
				</span>
			</div>

			<div id="messageBoard-${uniqueId}" style="display:none;"> <p> </p> </div>

			<div id="overview-${uniqueId}" style="display:none;">
				<div ng-repeat="device in devices track by $index">
					<md-list flex ng-cloak ng-if="(filteredDeviceTimers = (timers | filter:{ output: $index.toString() }:true)).length">
						<md-subheader> <span class="md-subhead"> {{devices[$index]}} </span> </md-subheader>
						<md-list-item ng-repeat="timer in filteredDeviceTimers" ng-click="switchToDevice($index)" style="min-height: 35px; cursor: pointer;">
							<span flex="40"> {{millisToTime(timer.starttime)}}&#8209;{{eventMode ? eventToEventLabel(timer.event) : millisToTime(timer.endtime)}} </span>
							<span flex="60" style="text-align: right; font-size: 0.8em;">
								<span ng-repeat="day in days" ng-if="timer.days[localDayToUtc(timer, $index)] === 1"> {{days[$index]}} </span>
							</span>
						</md-list-item>
					</md-list>
				</div>
			</div>

			<div id="timersView-${uniqueId}">
				<md-list flex ng-cloak>
					<md-list-item class="md-2-line" style="height: 74px; padding: 0 5px;" ng-repeat="timer in timers | filter:{ output: myDeviceSelect }:true" ng-click="showAddView(timers.indexOf(timer))">
						<div class="md-list-item-text">
							<div layout="row" layout-align="center center">
								<span style="font-size: 1.1em;"> {{millisToTime(timer.starttime)}} ${config.eventMode ? ` → {{eventToEventLabel(timer.event)}}` : ` - {{millisToTime(timer.endtime)}}`} </span>
							</div>
							<div layout="row" layout-align="center center" style="padding-top: 5px;">
								<span flex="" ng-repeat="day in days | limitTo : ${config.startDay}-7" ng-init="dayIndex=$index+${config.startDay}">
									<span class="weekDay {{(timer.days[localDayToUtc(timer,dayIndex)]) ? 'weekDayActive' : ''}}"> {{days[dayIndex]}} </span>
								</span>
								<span flex="" ng-repeat="day in days | limitTo : -${config.startDay}" ng-init="dayIndex=$index">
									<span class="weekDay {{(timer.days[localDayToUtc(timer,dayIndex)]) ? 'weekDayActive' : ''}}"> {{days[dayIndex]}} </span>
								</span>
							</div>
						</div>
					</md-list-item>
				</md-list>
			</div>

			<div id="addTimerView-${uniqueId}" style="display:none;">
				<form ng-submit="addTimer()">
					<div layout="row" layout-align="space-between none">
						<md-input-container flex="50">
							<label>${RED._("time-scheduler.ui.starttime")}</label>
							<input id="timerStarttime-${uniqueId}" type="time" required>
						</md-input-container>
						${config.eventMode ? `
						<md-input-container flex="50">
							<label>${RED._("time-scheduler.ui.event")}</label>
							<md-select ng-model="formtimer.timerEvent" required>
								<md-option ng-repeat="option in eventOptions" value={{option.event}}> {{option.label}} </md-option>
							</md-select>
						</md-input-container>
						` : `
						<md-input-container flex="50">
							<label>${RED._("time-scheduler.ui.endtime")}</label>
							<input id="timerEndtime-${uniqueId}" type="time" required>
						</md-input-container>
						`}
					</div>
					<md-input-container>
						<label>${RED._("time-scheduler.ui.daysActive")}</label>
						<md-select multiple="true" ng-model="formtimer.dayselect" ng-change="daysChanged()">
							<md-option value="all"><em>Select All</em></md-option>
							<md-option ng-repeat="day in days" value={{$index}}> {{days[$index]}} </md-option>
						</md-select>
					</md-input-container>
					<div layout="row" layout-align="end center">
						<md-button ng-if="formtimer.index !== undefined" ng-click="deleteTimer()"> <md-icon> delete </md-icon> </md-button>
						<md-button type="submit"> <md-icon> done </md-icon> </md-button>
					</div>
				</form>
			</div>
		</div>
		`;

		return String.raw`${styles}${timerBody}`;
	}

	function TimeSchedulerNode(config) {
		let ui = RED.require("node-red-dashboard")(RED);
		RED.nodes.createNode(this, config);
		const node = this;

		// Standard Property Defaults
		if (!config.devices || config.devices.length === 0) config.devices = [config.name];
		config.i18n = RED._("time-scheduler.ui", { returnObjects: true });

		const done = ui.addWidget({
			node: node,
			format: HTML(config),
			templateScope: "local",
			group: config.group,
			initController: function($scope) {
				$scope.init = function(config) {
					$scope.nodeId = config.id;
					$scope.i18n = config.i18n;
					$scope.days = config.i18n.days;
					$scope.devices = config.devices;
					$scope.myDeviceSelect = $scope.devices.length > 1 ? "overview" : "0";
					$scope.eventMode = config.eventMode;
					$scope.eventOptions = config.eventOptions;
				}

				$scope.toggleViews = function() {
					if ($scope.isEditMode) $scope.showStandardView();
					else {
						const existing = $scope.timers.find(t => t.output == $scope.myDeviceSelect);
						$scope.showAddView(existing ? $scope.timers.indexOf(existing) : undefined);
					}
				}

				$scope.switchToDevice = function(idx) {
					$scope.myDeviceSelect = idx.toString();
					$scope.showStandardView();
				}

				$scope.showStandardView = function() {
					$scope.isEditMode = false;
					$scope.getElement("timersView").style.display = ($scope.myDeviceSelect === "overview") ? "none" : "block";
					$scope.getElement("overview").style.display = ($scope.myDeviceSelect === "overview") ? "block" : "none";
					$scope.getElement("addTimerView").style.display = "none";
					$scope.getElement("messageBoard").style.display = "none";
				}

				$scope.showAddView = function(timerIndex) {
					$scope.isEditMode = true;
					$scope.getElement("timersView").style.display = "none";
					$scope.getElement("addTimerView").style.display = "block";
					$scope.formtimer = { index: timerIndex, dayselect: [] };

					if (timerIndex !== undefined) {
						const timer = $scope.timers[timerIndex];
						const start = new Date(timer.starttime);
						$scope.getElement("timerStarttime").value = $scope.formatTime(start.getHours(), start.getMinutes());
						if (!$scope.eventMode) {
							const end = new Date(timer.endtime);
							$scope.getElement("timerEndtime").value = $scope.formatTime(end.getHours(), end.getMinutes());
						} else { $scope.formtimer.timerEvent = timer.event; }
						for (let i = 0; i < timer.days.length; i++) {
							if (timer.days[$scope.localDayToUtc(timer, i)]) $scope.formtimer.dayselect.push(i);
						}
					}
				}

				$scope.addTimer = function() {
					const now = new Date();
					const startInput = $scope.getElement("timerStarttime").value.split(":");
					const starttime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startInput[0], startInput[1], 0, 0).getTime();

					const timer = {
						starttime: starttime,
						days: [0, 0, 0, 0, 0, 0, 0],
						output: $scope.myDeviceSelect
					};

					if ($scope.eventMode) {
						timer.event = $scope.formtimer.timerEvent;
					} else {
						const endInput = $scope.getElement("timerEndtime").value.split(":");
						timer.endtime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endInput[0], endInput[1], 0, 0).getTime();
					}

					$scope.formtimer.dayselect.forEach(day => {
						timer.days[$scope.localDayToUtc(timer, Number(day))] = 1;
					});

					// ENFORCEMENT: Find and replace existing for this output
					const idx = $scope.timers.findIndex(t => t.output == $scope.myDeviceSelect);
					if (idx !== -1) $scope.timers.splice(idx, 1, timer);
					else $scope.timers.push(timer);

					$scope.sendTimersToOutput();
				}

				$scope.deleteTimer = function() {
					$scope.timers.splice($scope.formtimer.index, 1);
					$scope.sendTimersToOutput();
				}

				$scope.sendTimersToOutput = function() {
					$scope.send([{ payload: { timers: angular.copy($scope.timers), settings: {} } }]);
					$scope.showStandardView();
				}

				$scope.daysChanged = function() {
					if ($scope.formtimer.dayselect.includes('all')) $scope.formtimer.dayselect = [0,1,2,3,4,5,6];
				}

				$scope.millisToTime = function(m) { const d = new Date(m); return $scope.formatTime(d.getHours(), d.getMinutes()); }
				$scope.formatTime = function(h, m) { return $scope.padZero(h) + ":" + $scope.padZero(m); }
				$scope.padZero = function(i) { return i < 10 ? "0" + i : i; }
				$scope.localDayToUtc = function(t, d) {
					const s = new Date(t.starttime);
					let shift = s.getUTCDay() - s.getDay();
					if (shift < -1) shift = 1; if (shift > 1) shift = -1;
					let u = shift + d;
					if (u < 0) u = 6; if (u > 6) u = 0;
					return u;
				}
				$scope.eventToEventLabel = function(e) {
					const o = $scope.eventOptions.find(opt => opt.event === e.toString());
					return o ? o.label : e;
				}
				$scope.getElement = function(id) { return document.querySelector("#" + id + "-" + $scope.nodeId.replace(".", "")); }
				
				$scope.$watch('msg', function() { $scope.getTimersFromServer(); });
				$scope.getTimersFromServer = function() {
					$.ajax({
						url: "time-scheduler/getNode/" + $scope.nodeId, dataType: 'json',
						success: function(json) {
							$scope.timers = json.timers || [];
							$scope.$digest();
						}
					});
				}
			}
		});
	}
	RED.nodes.registerType("ui_time_scheduler", TimeSchedulerNode);

	RED.httpNode.get('/ui/time-scheduler/getNode/:nodeId', function(req, res) {
		const node = RED.nodes.getNode(req.params.nodeId);
		node ? res.send({ timers: node.context().get('timers') || [] }) : res.sendStatus(404);
	});
}
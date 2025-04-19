#!/usr/bin/env node

import { showTimestamp, mqttAddress, devices, tgToken, tgMsgId, wcUrl1, wcUrl2 } from './env.mjs'

import * as mqtt from 'mqtt'
import dayjs from "dayjs";
import chalk from 'chalk';

const mqttClient = mqtt.connect(mqttAddress)

const portals = {}

const MAX_WATT = 3000;
let tempMaxWatt = 0;
let deviceName;
let deviceNameLong;
let regexPattern;
let deviceNames;

const updatedDevices = {};

const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');
const isDebug = process.argv.includes('--debug');

function verbose(msg) {
  if (isVerbose) {
    console.log(msg);
  }
}

function debug(msg) {
  if (isDebug) {
    console.log(msg);
  }
}

function getDeviceStatus(statusCode) {
  const normalizedInput = String(statusCode).toLowerCase();
  const map = { true: 'ON', false: 'OFF' };
  const res = map[normalizedInput];

  if (res === undefined) {
    res = "unknown";
  }

  return res;
}

function getPortalStatus(statusCode) {
  return statusCode === 0 ? 'OPENED' : statusCode === 1 ? 'CLOSED' : 'unknown';
}

function getPirStatus(statusCode) {
  return statusCode === 0 ? 'SLEEP' : statusCode === 1 ? 'DETECTED' : 'unknown';
}

function getMwStatus(statusCode) {
  return statusCode === 0 ? 'DETECTED' : statusCode === 1 ? 'SLEEP' : 'unknown';
}

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

// starting 
console.log(getTime() + chalk.green('telegramr: Starting ...'))
verbose(getTime() + chalk.yellow('mode: verbose'))
debug(getTime() + chalk.yellow('mode: debug'))

// connect to all mqtt topics
mqttClient.on('connect', function() {
  for (const device of devices.devices) {
    if (device.telegram) {
      mqttClient.subscribe(device.mqtt, function(err) {
        if (!device.longName) {
          device.longName = device.name;
        }
        if (err) {
          console.error(getTime() + 'mqtt: Error subscribing to ' + device.longName + ',' + err);
        } else {
          console.log(getTime() + 'mqtt: Connected to ' + device.longName);
        }
      });
    }
  }
})

mqttClient.on('message', function(topic, payload) {
  let jsonObj = '';
  // VERBOSE
  //console.log(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())
  verbose(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())

  try {
    jsonObj = JSON.parse(payload);
    // DEBUG
    debug(getTime() + 'jsonObj: ' + JSON.stringify(jsonObj));
    debug(getTime() + 'Payload JSON: ' + payload.toString());
  } catch (error) {
    debug(getTime() + 'Payload no jsonObj ' + payload)
    debug('Payload not JSON');
  }


  // Sensor868
  // /^muh\/sensors\/22\/json$/
  //let topicHeadregexPattern = new RegExp("^" + topic.replace(/\//g, "\\/").replace(/\d+/g, ".+") + "/")
  //console.log(topicHeadregexPattern)

  if (topic.split("/").length > 2) {
    // deviceNames = ['a07', '33c', '4f6'];
    deviceNames = {
      //'a07': 'Garten'
      //'33c': 'Stiege',
      '4f6': 'GarageOpenerTouran'
    };
    deviceName = topic.split("/")[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regexPattern = new RegExp("^" + topic.replace(/\//g, "\\/") + "$");

    //if (/^muh\/sensors\/.+/.test(topic)) {
    //  if (/\/(json)$/.test(topic)) {
    if (regexPattern.test(topic)) {
      //if (deviceNames.includes(topic.toString().split('/')[2])) {
      if (deviceNames.hasOwnProperty(topic.toString().split('/')[2])) {
        deviceName = topic.split("/")[2];
        if (jsonObj.hasOwnProperty("B1") && typeof jsonObj.B1 == 'number' && !isNaN(jsonObj.B1) && Number.isInteger(jsonObj.B1) &&
          typeof jsonObj.B1 !== "undefined" && jsonObj.B1 !== null && jsonObj.B1 !== "") {
          if (jsonObj.B1) {
            if (deviceNames.hasOwnProperty(deviceName)) {
              sendTelegram(deviceName + ': ' + deviceNames[deviceName] + ' ' + jsonObj.B1.toString());
            }
          }
        }
      }
      // }
    }
  }

})



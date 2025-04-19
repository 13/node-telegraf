#!/usr/bin/env node

// fix ETELEGRAM: 400 Bad Request: invalid file HTTP URL specified: URL host is empty
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
// https://github.com/yagop/node-telegram-bot-api/issues/1071
process.env.NTBA_FIX_350 = true;

import { showTimestamp, mqttAddress, devices, tgToken, tgMsgId, wcUrl1 } from './env.mjs'

import * as mqtt from 'mqtt'
import dayjs from "dayjs";
import chalk from 'chalk';

const mqttClient = mqtt.connect(mqttAddress)

const portals = {}


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

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

// starting 
console.log(getTime() + chalk.green('nulleinspeisung: Starting ...'))
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
    debug(getTime() + 'jsonObj: ' + jsonObj.state);
    debug(getTime() + 'Payload JSON: ' + JSON.parse(payload));
  } catch (error) {
    debug(getTime() + 'Payload no jsonObj ' + payload)
    debug('Payload not JSON');
  }

})



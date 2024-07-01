#!/usr/bin/env node

// fix ETELEGRAM: 400 Bad Request: invalid file HTTP URL specified: URL host is empty
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
// https://github.com/yagop/node-telegram-bot-api/issues/1071
process.env.NTBA_FIX_350 = true;

import { showTimestamp, mqttAddress, devices, tgToken, tgMsgId, wcUrl1 } from './env.mjs'

import * as mqtt from 'mqtt'
import dayjs from "dayjs";
import chalk from 'chalk';

import * as img_download from 'image-downloader'
import TelegramBot from 'node-telegram-bot-api'

const bot = new TelegramBot(tgToken, { polling: false })

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

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

function downloadImage(name_long, img_url, img_path) {
  return new Promise((resolve, reject) => {
    var img_options = {
      url: img_url,
      dest: img_path
    }
    img_download.image(img_options)
      .then(({ filename }) => {
        console.log(getTime() + 'telegram: image downloaded to ' + filename)
      })
      .catch((err) => console.error(err))
    setTimeout(() => {
      resolve()
    }, 5000)
  })
}

async function sendTelegram(name_long, img = null) {
  if (img != null) {
    var img_url = wcUrl1
    var img_path = '/tmp/urlCam-' + dayjs(new Date()).format('YYMMDD-HHmmssSSS') + '.jpg'
    await downloadImage(name_long, img_url, img_path)
    debug(getTime() + 'telegram: image sent ' + name_long + ' ' + img_path)
    bot.sendPhoto(tgMsgId, img_path, { caption: name_long + '\n ' + dayjs(new Date()).format('HH:mm:ss.SSS') })
  } else {
    debug(getTime() + 'telegram: sent ' + name_long.replace(/:/g, ''));
    bot.sendMessage(tgMsgId, name_long + ' ' + dayjs(new Date()).format('HH:mm:ss.SSS'))
    //bot.sendMessage(tgMsgId, name_long ' ' + dayjs(new Date()).format('HH:mm:ss.SSS'))
  }
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

  if (/^muh\/portal\/.+/.test(topic)) {
    if (/\/(json)$/.test(topic)) {
      if (typeof jsonObj.state == 'number' && !isNaN(jsonObj.state) && Number.isInteger(jsonObj.state) &&
        typeof jsonObj.state !== "undefined" && jsonObj.state !== null && jsonObj.state !== "") {
        if (topic.toString().split('/')[2] === 'HDB') {
          sendTelegram('Portal: ' + topic.toString().split('/')[2] + ' ' + jsonObj.state.toString(), 1)
        } else {
          if (['G', 'GD', 'HD', 'GDL', 'HDL'].includes(topic.toString().split('/')[2])) {
            if (!(topic.toString().split('/')[2] in portals)) {
              portals[topic.toString().split('/')[2]] = jsonObj.state
            }
            if (portals[topic.toString().split('/')[2]] != jsonObj.state.toString()) {
              portals[topic.toString().split('/')[2]] = jsonObj.state
              sendTelegram('Portal: ' + topic.toString().split('/')[2] + ' ' + getPortalStatus(jsonObj.state))
            }
            // DEBUG
            //debug(getTime() + 'portals: ' + Object.entries(portals).map(([key, value]) => `${key}: ${value}`).join(', '));
          }
        }
      }
      // RFID uid
      if (typeof jsonObj.uid !== "undefined" && jsonObj.uid !== null && jsonObj.uid !== "") {
        //sendTelegram('RFID: ' + topic.toString().split('/')[2] + ' ' + jsonObj.uid.toString())
        //if (jsonObj.uid > 0 && jsonObj.uid < 10)
        sendTelegram(topic.toString().split('/')[2] + ': ' + jsonObj.uid.toString())
      }
    }
  }

  // em3
  deviceName = '3em';
  // console.log(devices.devices.find(device => device.name === deviceName) ? new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic) ? "The topic matches the MQTT pattern of the device." : "The topic does not match the MQTT pattern of the device." : "Device not found.");
  if (devices.devices.find(device => device.name !== undefined) && new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic)) {
    //if (new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic)) {
    //if (/^shellies\/shellyem3\/emeter\/0\/.+/.test(topic)) {
    if (/\/power$/.test(topic.toString())) {
      if (payload.toString() >= devices.devices.find(device => device.name === deviceName).maxWatt) {
        if (payload.toString() >= devices.devices.find(device => device.name === deviceName).lastMaxWatt) {
          devices.devices.find(device => device.name === deviceName).lastMaxWatt = payload.toString();
          sendTelegram('EM3: ' + topic.toString().substring(topic.toString().lastIndexOf('/') + 1) + ' ' + payload.toString())
        } else {
          if ((payload.toString() >= devices.devices.find(device => device.name === deviceName).lastMaxWatt - payload.toString()) > 500) {
            devices.devices.find(device => device.name === deviceName).lastMaxWatt = 0;
          }
        }
      }
    }
  }

  deviceName = 'HZ_DG';
  if (new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic)) {
    if (jsonObj.hasOwnProperty("output") && typeof jsonObj.output === "boolean" &&
      (typeof jsonObj.output !== "undefined" && jsonObj.output !== null && jsonObj.output !== "")) {
      if (devices.devices.find(device => device.name === deviceName).lastOutput != jsonObj.output) {
        devices.devices.find(device => device.name === deviceName).lastOutput = jsonObj.output;
        sendTelegram(deviceName + ': ' + getDeviceStatus(jsonObj.output.toString()));
      }
    }
  }

  deviceName = 'DG_PIR';
  if (new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic)) {
    if (jsonObj.hasOwnProperty("occupancy") && typeof jsonObj.occupancy === "boolean" &&
      (typeof jsonObj.occupancy !== "undefined" && jsonObj.occupancy !== null && jsonObj.occupancy !== "")) {
      if (jsonObj.occupancy) {
        sendTelegram(deviceName + ': ' + getDeviceStatus(jsonObj.occupancy.toString()));
      }
    }
  }

  deviceName = 'TelegramBot';
  //if (/^muh\/telegram\/msg$/.test(topic)) {
  if (new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic)) {
    sendTelegram(payload.toString());
  }

  /*deviceNameLong = 'Garage';
  if (/^muh\/home\/garage\/isFull$/.test(topic)) {
    //if (new RegExp(devices.devices.find(device => device.name === deviceName).mqtt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).test(topic)){
    sendTelegram(deviceNameLong + ": " + payload.toString());
  }*/

  // Sensor868
  // /^muh\/sensors\/22\/json$/
  //let topicHeadregexPattern = new RegExp("^" + topic.replace(/\//g, "\\/").replace(/\d+/g, ".+") + "/")
  //console.log(topicHeadregexPattern)

  if (topic.split("/").length > 2) {
    // deviceNames = ['a07', '33c', '4f6'];
    deviceNames = {
      //'a07': 'Garten'
      //'33c': 'Stiege',
      '4f6': 'Post'
    };
    deviceName = topic.split("/")[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regexPattern = new RegExp("^" + topic.replace(/\//g, "\\/") + "$");

    //if (/^muh\/sensors\/.+/.test(topic)) {
    //  if (/\/(json)$/.test(topic)) {
    if (regexPattern.test(topic)) {
      //if (deviceNames.includes(topic.toString().split('/')[2])) {
      if (deviceNames.hasOwnProperty(topic.toString().split('/')[2])) {
        deviceName = topic.split("/")[2];
        if (jsonObj.hasOwnProperty("M1") && typeof jsonObj.M1 == 'number' && !isNaN(jsonObj.M1) && Number.isInteger(jsonObj.M1) &&
          typeof jsonObj.M1 !== "undefined" && jsonObj.M1 !== null && jsonObj.M1 !== "") {
          if (jsonObj.M1) {
            if (deviceNames.hasOwnProperty(deviceName)) {
              sendTelegram(deviceName + ': ' + deviceNames[deviceName] + ' ' + jsonObj.M1.toString());
            }
            /*if (deviceName === deviceNames[2]) {
              sendTelegram(deviceName + ': Post ' + jsonObj.M1.toString());
            } else if (deviceName === deviceNames[1]) {
              sendTelegram(deviceName + ': Stiege ' + jsonObj.M1.toString());
            } else if (deviceName === deviceNames[0]) {
              sendTelegram(deviceName + ': Garten ' + jsonObj.M1.toString()); // a07
            } else {
              sendTelegram(deviceName + ': ' + jsonObj.M1.toString());
            }*/
          }
        }
      }
      // }
    }
  }

})



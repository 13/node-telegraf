#!/usr/bin/env node

import { showTimestamp } from './env.mjs'

import * as mqtt from 'mqtt'
import dayjs from "dayjs";
import chalk from 'chalk';

// MQTT server details
const mqttServer1 = 'mqtt://192.168.22.5:1881';
const mqttServer2 = 'mqtt://192.168.22.5:1883';
const mqttTopic = 'muh/sensors/#';
// const mqttTopic2 = 'muh/esp/#';

// Create MQTT clients
const client1 = mqtt.connect(mqttServer1);
const client2 = mqtt.connect(mqttServer2);

const sensorData = {};

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

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

function updateData(dict, key, value) {
  if (dict.hasOwnProperty(key)) {
    if (dict[key] !== value) {
      // update value
      console.log(getTime() + 'data: Update ' + key + ':' + value);
      dict[key] = value;
    }
    else {
      console.log(getTime() + 'data: Duplicate ' + key + ':' + value);
    }
  } else {
    // add key & value
    console.log(getTime() + 'data: Add ' + key + ':' + value);
    dict[key] = value;
  }
}

// starting                                                                                    
console.log(getTime() + chalk.green('mqtt-wrappr: Starting ...'))
verbose(getTime() + chalk.yellow('mode: verbose'))
debug(getTime() + chalk.yellow('mode: debug'))

// Listen for incoming messages on the first MQTT server
client1.on('connect', () => {
  console.log(getTime() + 'mqtt: Connected to ' + mqttServer1.toString());
  client1.subscribe(mqttTopic, function(err) {
    if (err) {
      console.error(getTime() + 'mqtt: Error subscribing to ' + mqttTopic + ',' + err
      );
    } else {
      console.log(getTime() + 'mqtt: Subscribed to ' + mqttTopic);
    }
  });
  /*  client1.subscribe(mqttTopic2, function(err) {
      if (err) {
        console.error(getTime() + 'mqtt: Error subscribing to ' + mqttTopic2 + ',' + err
        );
      } else {
        console.log(getTime() + 'mqtt: Subscribed to ' + mqttTopic2);
      }
    });*/
});

client2.on('connect', () => {
  console.log(getTime() + 'mqtt: Connected to ' + mqttServer2.toString());
  client2.subscribe(mqttTopic, function(err) {
    if (err) {
      console.error(getTime() + 'mqtt: Error subscribing to ' + mqttTopic + ',' + err
      );
    } else {
      console.log(getTime() + 'mqtt: Subscribed to ' + mqttTopic);
    }
  });
});

client1.on('message', (topic, payload, packet) => {

  let jsonObj = '';
  // VERBOSE
  verbose(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())

  try {
    jsonObj = JSON.parse(payload);
    // DEBUG
    debug(getTime() + 'Payload JSON: ' + JSON.parse(payload));
  } catch (error) {
    debug(getTime() + 'Payload no jsonObj ' + payload)
  }

  if (typeof jsonObj.N !== "undefined" && jsonObj.N !== null && jsonObj.N !== "" &&
    typeof jsonObj.X !== "undefined" && jsonObj.X !== null && jsonObj.X !== "") {


    if (sensorData.hasOwnProperty(jsonObj.N) !== jsonObj.N &&
      sensorData[jsonObj.N] !== jsonObj.X) {
      // Publish the message to the second MQTT server
      console.log(getTime() + 'data: Publishing to ' + mqttServer2.toString());
      updateData(sensorData, jsonObj.N, jsonObj.X);
      client2.publish(topic, payload, { retain: packet.retain ? true : false });
    }

    // debug
    /*console.log(getTime() + 'data: print all ' + mqttServer1.toString());
    for (const key in sensorData) {
      console.log(`${key}: ${sensorData[key]}`);
    }*/

  }
});

client2.on('message', (topic, payload) => {

  let jsonObj = '';
  // VERBOSE
  verbose(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())

  try {
    jsonObj = JSON.parse(payload);
    // DEBUG
    debug(getTime() + 'jsonObj: ' + jsonObj.state);
    debug(getTime() + 'Payload JSON: ' + JSON.parse(payload));
  } catch (error) {
    debug(getTime() + 'Payload no jsonObj ' + payload)
  }

  if (typeof jsonObj.N !== "undefined" && jsonObj.N !== null && jsonObj.N !== "" &&
    typeof jsonObj.X !== "undefined" && jsonObj.X !== null && jsonObj.X !== "") {
    //console.log(getTime() + 'data: Topic ' + topic.toString() + ', Payload ' + payload.toString())
    debug(getTime() + 'data: Processing from #2 ' + mqttServer2.toString());
    updateData(sensorData, jsonObj.N, jsonObj.X);
  }
});


#!/usr/bin/env node

import {
  showTimestamp,
  mqttAddress,
  influxUrl,
  influxToken,
  influxOrg,
  influxBucket,
  devices,
} from "./env.mjs";

import * as mqtt from "mqtt";
import { InfluxDB, Point, HttpError } from "@influxdata/influxdb-client";
import { hostname } from "node:os";
import dayjs from "dayjs";
import chalk from "chalk";

const influxClient = new InfluxDB({ url: influxUrl, token: influxToken });
let writeClient = influxClient.getWriteApi(influxOrg, influxBucket, "ns");

writeClient.useDefaultTags({ server: hostname() });

const mqttClient = mqtt.connect(mqttAddress);

let testxx = "";
let source = "";
let type = "";
let measurement = "";
let name = "";

function isNumericWithDecimal(str) {
  return /^(-?\d+(\.\d+)?)$/.test(str);
}

function checkValueType(value, point) {
  if (typeof value === "string") {
    if (isNumericWithDecimal(value)) {
      point = point.floatField("value", value);
    } else {
      point = point.stringField("value", value);
    }
    insertInfluxDB(point);
  } else if (typeof value === "number" && Number.isInteger(value)) {
    point = point.intField("value", value);
    insertInfluxDB(point);
  } else if (typeof value === "number" && !Number.isNaN(value)) {
    point = point.floatField("value", value);
    insertInfluxDB(point);
  }
}

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

const insertInfluxDB = async (point) => {
  try {
    await writeClient.writePoint(point);
    await writeClient.flush();
    // verbose
    //console.log(getTime() + 'influxdb: ' + chalk.green('insert ') + point);
  } catch (error) {
    console.log(getTime() + "" + chalk.red("influxdb: insert error ") + point + " " + error);
  }
};

// rain query
let startup = true;
let lastRain = 0;
let lastRainDB = 0;
let lastRainTmp = 0;
let queryClient = influxClient.getQueryApi(influxOrg);
let fluxQuery = `from(bucket: "muh")
|> range(start: -1h)
|> filter(fn: (r) => r._measurement == "rain_m")
|> filter(fn: (r) => r._field == "value")
|> filter(fn: (r) => r.node == "wst")
|> sort(columns: ["_time"])
|> map(fn: (r) => ({_value: r._value, _time: r._time, _field: "Regen"}))
|> last()`;

queryClient.queryRows(fluxQuery, {
  next: (row, tableMeta) => {
    const tableObject = tableMeta.toObject(row);
    //console.log(tableObject._value)
    console.error(
      getTime() + "influxdb2: Initial rain " + chalk.green(tableObject._value),
    );
    lastRainDB = tableObject._value;
  },
  error: (error) => {
    //console.error('\nError', error)
  },
  complete: () => {
    //console.log('\nSuccess')
  },
});

// starting
console.log(getTime() + chalk.green("Starting ..."));

// connect to all mqtt topics
mqttClient.on("connect", function () {
  for (const device of devices.devices) {
    mqttClient.subscribe(device.mqtt, function (err) {
      if (err) {
        console.error(
          getTime() + "mqtt: Error subscribing to " + device.name + "," + err,
        );
      } else {
        console.log(getTime() + "mqtt: Connected to " + device.name);
      }
    });
  }
});

mqttClient.on("message", function (topic, payload) {
  let jsonObj = "";
  // verbose
  // console.log(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())

  try {
    jsonObj = JSON.parse(payload);
    // console.log('Payload JSON: ' + JSON.parse(payload));
  } catch (error) {
    // console.log(getTime() + 'Payload no jsonObj ' + payload)
    // console.log('Payload not JSON');
  }

  if (jsonObj === null && jsonObj === undefined) {
    jsonObj = "";
  }
  // portal set offline if again online put online
  /*if (/^tasmota\/tele\/tasmota_DC37B8\/LWT/.test(topic)) {
    if (payload.toString() === 'Offline'){
      var topics = ['muh/portal/G/json', 'muh/portal/GD/json', 'muh/portal/GDL/json', 'muh/portal/GDP/json'];
      for (var i = 0; i < topics.length; i++) {
        console.log(getTime() + 'mqtt: Publish ' + topics[i] + ', state 0 ' + new Date().toISOString());
        mqttClient.publish(topics[i], JSON.stringify({'state': 0, 'time': new Date().toISOString()}), { retain: true });
      }
    }
  }
  if (/^tasmota\/tele\/tasmota_74EDAC\/LWT/.test(topic)) {
    if (payload.toString() === 'Offline'){
      var topics = ['muh/portal/HD/json', 'muh/portal/HDL/json', 'muh/portal/HDP/json'];
      for (var i = 0; i < topics.length; i++) {
        console.log(getTime() + 'mqtt: Publish ' + topics[i] + ', state 0 ' + new Date().toISOString());
        mqttClient.publish(topics[i], JSON.stringify({'state': 0, 'time': new Date().toISOString()}), { retain: true });
      }
    }
  }*/
  // pv ez1-m
  if (/^muh\/pv\/E07000055917\/json/.test(topic)) {
    source = "pv";
    let measurement = "";
    let measurementValue = "";
    //console.log('PVV' + JSON.stringify(JSON.parse(payload)));
    //console.log("Payload JSON:", JSON.stringify(payload, null, 2));

    for (const key in jsonObj) {
      measurement = key;
      measurementValue = jsonObj[key];
      // console.log('PV: ' + key + " " + jsonObj[key]);
      // console.log('PVV: ' + JSON.stringify(jsonObj));
      // console.log('PVV: ' + jsonObj.data.p1);
      if (jsonObj.data && typeof jsonObj.data === 'object') {
      Object.entries(jsonObj.data).forEach(([dataKey, dataValue]) => {
        //console.log(`PV: ${key}: ${value}`);
        measurement = dataKey;
        measurementValue = dataValue;

          if (measurement == "p1" || measurement == "p2") {
            let point = new Point(measurement)
              .tag("node", "E07000055917")
              //.tag('node', topic.toString().split('/')[2])
              .tag("source", source)
              //.intField('value', jsonObj.p1.toString())
              .intField("value", measurementValue);
            insertInfluxDB(point);
          }
          if (measurement == "e1" || measurement == "e2") {
            let point = new Point(measurement)
              .tag("node", "E07000055917")
              //.tag('node', topic.toString().split('/')[2])
              .tag("source", source)
              //.intField('value', jsonObj.p1.toString())
              .floatField("value", measurementValue);
            insertInfluxDB(point);
          }
      });
      }
    }
  }

  // wsr
  if (/^muh\/wsr\/json/.test(topic)) {
    //if (/^muh\/wsr\/.+/.test(topic)) {
    //if (/\/(json)$/.test(topic)) {
    source = "esp";
    let measurement = "";
    let measurementValue = "";
    //console.log('WSR Payload JSON: ' + JSON.parse(payload));

    for (const key in jsonObj) {
      measurement = key;
      measurementValue = jsonObj[key];
      if (typeof measurementValue === "number") {
        measurementValue = measurementValue.toFixed(2);
      }
      let point = new Point(measurement)
        .tag("node", "wsr")
        .tag("source", source);
      checkValueType(measurementValue, point);
    }
    //}
  }

  if (/^muh\/wst\/.+/.test(topic)) {
    source = "esp";
    let measurement = "";
    let measurementValue = "";
    let isInt = "";

    if (/\/(data\/B327)$/.test(topic)) {
      for (const key in jsonObj) {
        measurement = key;
        measurementValue = jsonObj[key];
        if (typeof measurementValue === "number") {
          if (measurement === "rain") {
            measurement = "rainfall";
            measurementValue = measurementValue.toFixed(2);
            /*console.log(
              getTime() +
                "Rain: " +
                chalk.green(measurementValue) +
                ", DB " +
                lastRainDB +
                ", lastRainTmp " +
                lastRainTmp +
                ", last " +
                lastRain,
            );*/
            if (startup) {
              startup = false;
              lastRain = measurementValue;
              measurementValue = measurementValue - lastRainDB;
            } else {
              lastRainTmp = measurementValue;
              measurementValue = measurementValue - lastRain;
              lastRain = lastRainTmp;
            }
            if (measurementValue < 0) {
              measurementValue = 0;
            }
            /*console.log(
              getTime() +
                "Rain: " +
                chalk.green(measurementValue.toFixed(2)) +
                ", DB " +
                lastRainDB +
                ", lastRainTmp " +
                lastRainTmp +
                ", last " +
                lastRain,
            );*/
          }
          measurementValue = measurementValue.toFixed(2);
        }
        let point = new Point(measurement)
          .tag("node", "wst")
          .tag("source", source);
        checkValueType(measurementValue, point);
      }
    }
    if (/\/(extra)$/.test(topic)) {
      for (const key in jsonObj) {
        measurement = key;
        measurementValue = jsonObj[key];
        if (typeof measurementValue === "number") {
          measurementValue = measurementValue.toFixed(1);
        }
        let point = new Point(measurement)
          .tag("node", "wst")
          .tag("source", source);
        checkValueType(measurementValue, point);
      }
    }
    if (/\/(radio)$/.test(topic)) {
      for (const key in jsonObj) {
        measurement = key;
        measurementValue = jsonObj[key];
        if (measurement === "rssi") {
          isInt = true;
          measurementValue = parseInt(measurementValue);
        } else {
          isInt = false;
        }
        let point = new Point(measurement)
          .tag("node", "wst")
          .tag("source", source);
        checkValueType(measurementValue, point);
      }
    }
  }

  // portal
  if (/^muh\/portal\/.+/.test(topic)) {
    source = "tasmota";
    if (/\/(json)$/.test(topic)) {
      if (
        typeof jsonObj.state == "number" &&
        !isNaN(jsonObj.state) &&
        Number.isInteger(jsonObj.state) &&
        typeof jsonObj.state !== "undefined" &&
        jsonObj.state !== null &&
        jsonObj.state !== ""
      ) {
        if (topic.toString().split("/")[2] !== "GDW") {
          let point = new Point("portal")
            .tag("node", topic.toString().split("/")[2])
            .tag("source", source)
            .intField("value", jsonObj.state.toString());
          insertInfluxDB(point);
        }
      }
      // RFID uid
      if (
        typeof jsonObj.uid !== "undefined" &&
        jsonObj.uid !== null &&
        jsonObj.uid !== ""
      ) {
        let point = new Point("rfid")
          .tag("node", topic.toString().split("/")[2])
          .tag("destination", jsonObj.source)
          .tag("source", source)
          .stringField("value", jsonObj.uid.toString());
        insertInfluxDB(point);
      }
    }
  }
  // portal-old
  /*if (/^tasmota\/sensors\/.+/.test(topic)) {
    source = 'tasmota'
    if (/\/(state)$/.test(topic.toString())) {
      let point = new Point('portal')
        .tag('node', topic.toString().split('/')[2])
        .tag('source', source)
        .intField('value', payload.toString())
      insertInfluxDB(point);
    }
  }*/

  // tasmota 3em
  if (/^muh\/power\/3em.+/.test(topic)) {
    source = "tasmota";
    let measurement = "";
    let measurementValue = "";
    if (jsonObj !== undefined && jsonObj !== null && jsonObj !== "") {
      if (jsonObj.hasOwnProperty("total")) {
        //console.log(getTime() + 'mqtt: ' + chalk.yellow(jsonObj.total.toString()) + ' 3em');
        measurement = "power";
        measurementValue = parseFloat(jsonObj.total.toString());
        if (
          measurement !== undefined ||
          measurement !== null ||
          measurement !== "" ||
          measurementValue !== undefined ||
          measurementValue !== null ||
          measurementValue !== ""
        ) {
          let point = new Point(measurement)
            .tag("node", "3em")
            .tag("source", source)
            .floatField("value", measurementValue);
          insertInfluxDB(point);
        }
      }
      if (jsonObj.hasOwnProperty("total_zero")) {
        //console.log(getTime() + 'mqtt: ' + chalk.yellow(jsonObj.total_zero.toString()) + ' 3em');
        measurement = "power_zero";
        measurementValue = parseInt(jsonObj.total_zero.toString());
        if (
          measurement !== undefined ||
          measurement !== null ||
          measurement !== "" ||
          measurementValue !== undefined ||
          measurementValue !== null ||
          measurementValue !== ""
        ) {
          let point = new Point(measurement)
            .tag("node", "3em")
            .tag("source", source)
            .intField("value", measurementValue);
          insertInfluxDB(point);
        }
      }
    }
  }

  // tasmota power
  if (/^tasmota\/tele\/.+/.test(topic)) {
    source = "tasmota";
    let measurement = "";
    let measurementValue = "";
    if (jsonObj !== undefined && jsonObj !== null && jsonObj !== "") {
      if (
        jsonObj.hasOwnProperty("ENERGY") &&
        jsonObj.ENERGY.hasOwnProperty("Power")
      ) {
        //console.log(getTime() + 'mqtt: ' + chalk.yellow(jsonObj.ENERGY.Power.toString()) + ' ' + topic.toString().match(/tasmota_(\w+)/)?.[1]);
        measurement = "power";
        measurementValue = parseFloat(jsonObj.ENERGY.Power.toString());
        if (
          measurement !== undefined ||
          measurement !== null ||
          measurement !== "" ||
          measurementValue !== undefined ||
          measurementValue !== null ||
          measurementValue !== ""
        ) {
          let point = new Point(measurement)
            .tag("node", topic.toString().match(/tasmota_(\w+)/)?.[1])
            .tag("source", source)
            .floatField("value", measurementValue);
          insertInfluxDB(point);
        }
      }
      if (
        jsonObj.hasOwnProperty("ENERGY") &&
        jsonObj.ENERGY.hasOwnProperty("Total")
      ) {
        //console.log(getTime() + 'mqtt: ' + chalk.yellow(jsonObj.ENERGY.Power.toString()) + ' ' + topic.toString().match(/tasmota_(\w+)/)?.[1]);
        measurement = "kwh";
        measurementValue = parseFloat(jsonObj.ENERGY.Total.toString());
        if (
          measurement !== undefined ||
          measurement !== null ||
          measurement !== "" ||
          measurementValue !== undefined ||
          measurementValue !== null ||
          measurementValue !== ""
        ) {
          let point = new Point(measurement)
            .tag("node", topic.toString().match(/tasmota_(\w+)/)?.[1])
            .tag("source", source)
            .floatField("value", measurementValue);
          insertInfluxDB(point);
        }
      }
    } else {
      console.log(
        getTime() +
          "mqttXX: " +
          chalk.green(payload.toString()) +
          " " +
          topic.toString().match(/tasmota_(\w+)/)?.[1],
      );
      measurement = "";
    }
  }

  // shelly plugs
  if (/^shellies\/shellyplug-s-C13431\/relay\/0\/.+/.test(topic)) {
    source = "shelly";
    if (/\/(current|energy|pf|power|voltage)$/.test(topic.toString())) {
      let point = new Point(
        topic.toString().substring(topic.toString().lastIndexOf("/") + 1),
      )
        .tag("node", topic.toString().split("/")[1])
        .tag("source", source)
        .floatField("value", payload.toString());
      insertInfluxDB(point);
    }
  }

  // shelly motion 2
  // shellies/shellymotion2-8CF6811074B3/status motion, lux, bat, tmp.value
  if (/^shellies\/shellymotion2-8CF6811074B3\/status/.test(topic)) {
    source = "shelly";
    for (let propName in jsonObj) {
      const propValue = jsonObj[propName];
      measurement = "";
      // measurement
      switch (propName) {
        case "motion":
          measurement = propName;
          break;
        /*case "lux":
          measurement = "illuminance";
          // propValue = parseFloat(propValue);
          break;*/
        case "bat":
          measurement = "battery";
          break;
        default:
          measurement = "";
          break;
      }
      // lux
      /*if (measurement !== "" && typeof jsonObj.lux !== "undefined" && jsonObj.lux !== null && jsonObj.lux !== "" && !Number.isInteger(propValue)) {
        let point = new Point(measurement)
          .tag('node', topic.split('/')[1])
          .tag('name', name)
          .tag('source', source)
          .intField('value', propValue)
        insertInfluxDB(point);
      }*/
      // bat
      if (
        measurement !== "" &&
        typeof jsonObj.bat !== "undefined" &&
        jsonObj.bat !== null &&
        jsonObj.bat !== "" &&
        Number.isInteger(propValue)
      ) {
        let point = new Point(measurement)
          .tag("node", topic.split("/")[1])
          .tag("name", name)
          .tag("source", source)
          .intField("value", propValue);
        insertInfluxDB(point);
      }
      // motion
      if (
        measurement !== "" &&
        typeof jsonObj.motion !== "undefined" &&
        jsonObj.motion !== null &&
        jsonObj.motion !== "" &&
        typeof propValue === "boolean"
      ) {
        let point = new Point(measurement)
          .tag("node", topic.split("/")[1])
          .tag("name", name)
          .tag("source", source)
          .intField("value", propValue ? 1 : 0);
        insertInfluxDB(point);
      }
    }
  }

  // em3
  if (/^shellies\/shellyem3\/emeter\/0\/.+/.test(topic)) {
    source = "shelly";
    //
    if (/\/(current|energy|pf|power|voltage)$/.test(topic.toString())) {
      let point = new Point(
        topic.toString().substring(topic.toString().lastIndexOf("/") + 1),
      )
        .tag("node", topic.toString().split("/")[1])
        .tag("source", source)
        .floatField("value", payload.toString());
      insertInfluxDB(point);
    }
  }

  // solar
  if (/^shellies\/HZ_WW\/status\/temperature:\d+$/.test(topic)) {
    source = "shelly";
    type = "si7021";
    measurement = "temperature";
    // determine id
    switch (jsonObj.id) {
      case 100:
        name = "rlauf";
        break;
      case 101:
        name = "vlauf";
        break;
      case 102:
        name = "wwasser";
        break;
      default:
        console.log("noth");
        break;
    }
    if (
      typeof jsonObj.tC == "number" &&
      !isNaN(jsonObj.tC) &&
      !Number.isInteger(jsonObj.tC) &&
      typeof jsonObj.tC !== "undefined" &&
      jsonObj.tC !== null &&
      jsonObj.tC !== ""
    ) {
      let point = new Point(measurement)
        .tag("node", topic.split("/")[1])
        .tag("name", name)
        .tag("type", type)
        .tag("source", source)
        .floatField("value", jsonObj.tC);
      insertInfluxDB(point);
    }
  }

  // determine source
  /*if (jsonObj.hasOwnProperty('sid') && jsonObj.sid !== '') {
    source = 'esp'

    for (let propName in jsonObj) {
      const propValue = jsonObj[propName];

    switch (propName) {
      case 'temperature':
        measurement = 'temperature'
        break;
      case 'humidity':
        measurement = 'humidity'
        break;
      default:
        console.log("noth")
        break;
    }
      if(typeof jsonObj.tC == 'number' && !isNaN(jsonObj.tC) && !Number.isInteger(jsonObj.tC) &&
         typeof jsonObj.tC !== "undefined" && jsonObj.tC!== null && jsonObj.tC !== ""){
        let point = new Point(measurement)
        .tag('node', jsonObj.sid)
        .tag('name', name)
        .tag('type', type)
        .tag('source', source)
        .floatField('value', jsonObj.tC)
        insertInfluxDB(point);
      }
    }
    }*/
  /*
    // determine source
    if (jsonObj.hasOwnProperty('sid') && jsonObj.sid !== '') {
      source = 'esp'
  
      for (let propName in jsonObj) {
        const propValue = jsonObj[propName];
      switch (propName) {
        case 'temperature':
          measurement = 'temperature'
          break;
        case 'humidity':
          measurement = 'humidity'
          break;
        default:
          console.log("noth")
          break;
      }
  
        if (/^sid/i.test(propName)) {
          if(typeof propValue == 'number' && !isNaN(propValue) && 
             typeof propValue !== "undefined" && propValue !== null && propValue !== ""){
            let point = new Point(measurement)
              .tag('node', jsonObj.sid)
              .tag('type', jsonObj.type)
              .tag('source', source)
              .floatField('value', propValue)
            insertInfluxDB(point);
          }
        }
      }
    }
  */
  // DS18B20 multi
  // TODO
  // DS18B20
  if (jsonObj !== null && jsonObj !== undefined) {
    if (jsonObj.hasOwnProperty("TID") && jsonObj.TID !== "") {
      source = "tasmota";
      if (
        jsonObj.hasOwnProperty("DS18B20") &&
        jsonObj.DS18B20.hasOwnProperty("Temperature")
      ) {
        if (
          typeof jsonObj.DS18B20.Temperature == "number" &&
          !isNaN(jsonObj.DS18B20.Temperature) &&
          typeof jsonObj.DS18B20.Temperature !== "undefined" &&
          jsonObj.DS18B20.Temperature !== null &&
          jsonObj.DS18B20.Temperature !== ""
        ) {
          measurement = "temperature";
          type = "ds18b20";
          let point = new Point(measurement)
            .tag("node", jsonObj.TID)
            .tag("type", type)
            .tag("typeid", jsonObj.DS18B20.Id)
            .tag("source", source)
            .floatField("value", jsonObj.DS18B20.Temperature);
          insertInfluxDB(point);
        }
      }
    }
    // determine source
    if (jsonObj.hasOwnProperty("N") && jsonObj.N !== "") {
      source = "868";

      for (let propName in jsonObj) {
        const propValue = jsonObj[propName];

        // determine sensor type
        if (/^[M,S,T,H,P,Q]\d/i.test(propName)) {
          if (propName.startsWith("M")) {
            type = "pir";
          } else if (propName.startsWith("S")) {
            type = "switch";
          } else if (propName.endsWith("1")) {
            type = "si7021";
          } else if (propName.endsWith("2")) {
            type = "ds18b20";
          } else if (propName.endsWith("3")) {
            type = "bmp280";
          } else if (propName.endsWith("4")) {
            type = "bme680";
          } else {
            type = "unknown";
          }
        }

        // determine sensor measurement
        if (/^[T]\d/i.test(propName)) {
          measurement = "temperature";
        } else if (/^[H]\d/i.test(propName)) {
          measurement = "humidity";
        } else if (/^[P]\d/i.test(propName)) {
          measurement = "pressure";
        } else if (/^[V]\d/i.test(propName)) {
          measurement = "voltage";
        } else if (/^[Q]\d/i.test(propName)) {
          measurement = "air_quality";
        } else if (/^[M]\d/i.test(propName)) {
          measurement = "motion";
        } else if (/^[S]\d/i.test(propName)) {
          measurement = "switch";
        } else if (/^[RSSI]/i.test(propName)) {
          measurement = "rssi";
        } else if (/^[LQI]/i.test(propName)) {
          measurement = "lqi";
        } else {
          measurement = "unknown";
        }

        // float
        if (/^[T,H,P]\d/i.test(propName)) {
          if (
            typeof propValue == "number" &&
            !isNaN(propValue) &&
            typeof propValue !== "undefined" &&
            propValue !== null &&
            propValue !== ""
          ) {
            let point = new Point(measurement)
              .tag("node", jsonObj.N)
              .tag("node_receiver", jsonObj.RN)
              .tag("type", type)
              .tag("source", source)
              .floatField("value", propValue);
            insertInfluxDB(point);
          }
          // integer
        } else if (/^[Q,M,S]\d/i.test(propName)) {
          if (
            typeof propValue == "number" &&
            !isNaN(propValue) &&
            Number.isInteger(propValue) & (typeof propValue !== "undefined") &&
            propValue !== null &&
            propValue !== ""
          ) {
            let point = new Point(measurement)
              .tag("node", jsonObj.N)
              .tag("node_receiver", jsonObj.RN)
              .tag("type", type)
              .tag("source", source)
              .intField("value", propValue);
            insertInfluxDB(point);
          }
        } else if (/^[V]\d/i.test(propName)) {
          if (
            typeof propValue == "number" &&
            !isNaN(propValue) &&
            typeof propValue !== "undefined" &&
            propValue !== null &&
            propValue !== ""
          ) {
            let point = new Point(measurement)
              .tag("node", jsonObj.N)
              .tag("node_receiver", jsonObj.RN)
              .tag("source", source)
              .floatField("value", propValue);
            insertInfluxDB(point);
          }
        } else if (/^[RSSI,LQI]/i.test(propName)) {
          if (
            typeof propValue == "number" &&
            !isNaN(propValue) &&
            Number.isInteger(propValue) &&
            typeof propValue !== "undefined" &&
            propValue !== null &&
            propValue !== ""
          ) {
            let point = new Point(measurement)
              .tag("node", jsonObj.N)
              .tag("node_receiver", jsonObj.RN)
              .tag("source", source)
              .intField("value", propValue);
            insertInfluxDB(point);
          }
        } else {
          // console.log('nothing to do')
        }
      }
    }
  }
});

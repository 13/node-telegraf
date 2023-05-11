import * as mqtt from 'mqtt'

import {InfluxDB, Point, HttpError} from '@influxdata/influxdb-client'
import {url, token, org, bucket, mqttAddress} from './env.mjs'
import {hostname} from 'node:os'
import dayjs from "dayjs";

const writeClient = new InfluxDB({url, token}).getWriteApi(org, bucket, 'ns')
writeClient.useDefaultTags({server: hostname()})

const mqttClient = mqtt.connect(mqttAddress)

let source = ""
let type = ""
let measurement = ""
let name = ""

const showTimestamp = true;

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

mqttClient.on('connect', function() {
  mqttClient.subscribe('muh/sensors/#', function (err) {
    console.log(getTime() + 'mqtt: Connected to sensors')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
  mqttClient.subscribe('tasmota/tele/tasmota_74EDAC/LWT', function (err) {
    console.log(getTime() + 'mqtt: Connected to HD')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
  mqttClient.subscribe('tasmota/tele/tasmota_DC37B8/LWT', function (err) {
    console.log(getTime() + 'mqtt: Connected to GD')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
  mqttClient.subscribe('shellies/HZ_WW/status/#', function (err) {
    console.log(getTime() + 'mqtt: Connected to HZ_WW')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
  mqttClient.subscribe('shellies/shellyem3/emeter/0/#', function (err) {
    console.log(getTime() + 'mqtt: Connected to em3')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
  mqttClient.subscribe('shellies/shellyplug-s-C13431/relay/0/#', function (err) {
    console.log(getTime() + 'mqtt: Connected to plugs')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
 /* mqttClient.subscribe('tasmota/sensors/#', function (err) {
    console.log(getTime() + 'mqtt: Connected to portal-old')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })*/
  mqttClient.subscribe('muh/portal/#', function (err) {
    console.log(getTime() + 'mqtt: Connected to portal')
    //console.log(showTimestamp() + '' + scene.name + ': MQTT ' + light1.name + ' ' + light1.subscr + ' connected')
  })
})


const insertInfluxDB = async (point) => {
  try {
    await writeClient.writePoint(point);
    await writeClient.flush();
    console.log(getTime() + "influxdb: insert " + point);
  } catch (error) {
    console.log(getTime() + "influxdb: insert error ");
  }
};

mqttClient.on('message', function (topic, payload) {
  let jsonObj = '';
  console.log(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())

  try {
    jsonObj = JSON.parse(payload);
    // console.log('Payload JSON: ' + JSON.parse(payload));
  } catch (error) {
    // console.log('Payload not JSON');
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
  if (/^muh\/portal\/.+/.test(topic)) {
    source = 'tasmota'
    if (/\/(json)$/.test(topic)) {
      if(typeof jsonObj.state == 'number' && !isNaN(jsonObj.state) && Number.isInteger(jsonObj.state) &&
         typeof jsonObj.state !== "undefined" && jsonObj.state !== null && jsonObj.state !== ""){
        let point = new Point('portal')
          .tag('node', topic.toString().split('/')[2])
          .tag('source', source)
          .intField('value', jsonObj.state.toString())
        insertInfluxDB(point);
      }
      // RFID uid
      if(typeof jsonObj.uid !== "undefined" && jsonObj.uid !== null && jsonObj.uid !== ""){
        let point = new Point('rfid')
          .tag('node', topic.toString().split('/')[2])
          .tag('destination', jsonObj.source)
          .tag('source', source)
          .stringField('value', jsonObj.uid.toString())
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

  // plugs
  if (/^shellies\/shellyplug-s-C13431\/relay\/0\/.+/.test(topic)) {
    source = 'shelly'
    if (/\/(current|energy|pf|power|voltage)$/.test(topic.toString())) {
      let point = new Point((topic.toString().substring(topic.toString().lastIndexOf('/') + 1)))
        .tag('node', topic.toString().split('/')[1])
        .tag('source', source)
        .floatField('value', payload.toString())
      insertInfluxDB(point);
    }
  }

  // em3
  if (/^shellies\/shellyem3\/emeter\/0\/.+/.test(topic)) {
    source = 'shelly'
    //
    if (/\/(current|energy|pf|power|voltage)$/.test(topic.toString())) {
      let point = new Point((topic.toString().substring(topic.toString().lastIndexOf('/') + 1)))
        .tag('node', topic.toString().split('/')[1])
        .tag('source', source)
        .floatField('value', payload.toString())
      insertInfluxDB(point);
    }
  }

  // solar
  if (/^shellies\/HZ_WW\/status\/temperature:\d+$/.test(topic)) {
    source = 'shelly'
    type = 'si7021'
    measurement = 'temperature';
    // determine id
    switch (jsonObj.id) {
      case 100:
        name = "rlauf"
        break;
      case 101:
        name = "vlauf"
        break;
      case 102:
        name = "wwasser"
        break;
      default:
        console.log("noth")
        break;
    }
      if(typeof jsonObj.tC == 'number' && !isNaN(jsonObj.tC) && !Number.isInteger(jsonObj.tC) &&
         typeof jsonObj.tC !== "undefined" && jsonObj.tC!== null && jsonObj.tC !== ""){
        let point = new Point(measurement)
        .tag('node', topic.split('/')[1])
        .tag('name', name)
        .tag('type', type)
        .tag('source', source)
        .floatField('value', jsonObj.tC)
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

  // determine source
  if (jsonObj.hasOwnProperty('N') && jsonObj.N !== '') {
    source = '868'

    for (let propName in jsonObj) {
      const propValue = jsonObj[propName];

    // determine sensor type
    if (/^[T,H,P,Q]\d/i.test(propName)) {
      if (propName.endsWith('1')) {
        type = 'si7021'
      } else if (propName.endsWith('2')) {
        type = 'ds18b20'
      } else if (propName.endsWith('3')) {
        type = 'bmp280'
      } else if (propName.endsWith('4')) {
        type = 'bme680'
      } else {
        type = "unknown"
      }
    }

    // determine sensor measurement
    if (/^[T]\d/i.test(propName)) {
      measurement = 'temperature';
    } else if (/^[H]\d/i.test(propName)) {
      measurement = 'humidity';
    } else if (/^[P]\d/i.test(propName)) {
      measurement = 'pressure';
    } else if (/^[V]\d/i.test(propName)) {
      measurement = 'voltage';
    } else if (/^[Q]\d/i.test(propName)) {
      measurement = 'air_quality';
    } else if (/^[RSSI]/i.test(propName)) {
      measurement = 'rssi';
    } else if (/^[LQI]/i.test(propName)) {
      measurement = 'lqi';
    } else {
      measurement = 'unknown';
    }

    if (/^[T,H,P]\d/i.test(propName)) {
      if(typeof propValue == 'number' && !isNaN(propValue) && 
         typeof propValue !== "undefined" && propValue !== null && propValue !== ""){
        let point = new Point(measurement)
        .tag('node', jsonObj.N)
        .tag('node_receiver', jsonObj.RN)
        .tag('type', type)
        .tag('source', source)
        .floatField('value', propValue)
        insertInfluxDB(point);
      }
    } else if (/^[Q]\d/i.test(propName)) {
      if(typeof propValue == 'number' && !isNaN(propValue) && Number.isInteger(propValue) &
         typeof propValue !== "undefined" && propValue !== null && propValue !== ""){
        let point = new Point(measurement)
        .tag('node', jsonObj.N)
        .tag('node_receiver', jsonObj.RN)
        .tag('type', type)
        .tag('source', source)
        .intField('value', propValue)
        insertInfluxDB(point);
      }
    } else if (/^[V]\d/i.test(propName)) {
      if(typeof propValue == 'number' && !isNaN(propValue) && 
         typeof propValue !== "undefined" && propValue !== null && propValue !== ""){
        let point = new Point(measurement)
        .tag('node', jsonObj.N)
        .tag('node_receiver', jsonObj.RN)
        .tag('source', source)
        .floatField('value', propValue)
        insertInfluxDB(point);
      }
    } else if (/^[RSSI,LQI]/i.test(propName)) {
      if(typeof propValue == 'number' && !isNaN(propValue) && Number.isInteger(propValue) &&
         typeof propValue !== "undefined" && propValue !== null && propValue !== ""){
        let point = new Point(measurement)
        .tag('node', jsonObj.N)
        .tag('node_receiver', jsonObj.RN)
        .tag('source', source)
        .intField('value', propValue)
        insertInfluxDB(point);
      }
    } else {
        // console.log('nothing to do')
    }
    }
}
  
})



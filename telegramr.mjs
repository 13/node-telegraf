#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

import { showTimestamp, mqttAddress, devices, tgToken, tgMsgId, wcUrl1 } from './env.mjs'

import * as mqtt from 'mqtt'
import dayjs from "dayjs";
import chalk from 'chalk';

import * as img_download from 'image-downloader'
import TelegramBot from 'node-telegram-bot-api'

const bot = new TelegramBot(tgToken, {polling: false})

const mqttClient = mqtt.connect(mqttAddress)

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

function downloadImage(name_long,img_url,img_path){                                                                                                                                                                                                                                                                      
  return new Promise((resolve, reject) => {                                                                                                                                                                                                                                                                                    
    var img_options = {                                                                                                                                                                                                                                                                                                        
      url: img_url,                                                                                                                                                                                                                                                                                                            
      dest: img_path                                                                                                                                                                                                                                                                                                           
    }
    img_download.image(img_options)
      .then(({ filename }) => {
        console.log(getTime() + ': Image downloaded ' + filename)
      })
      .catch((err) => console.error(err))
    setTimeout(()=>{
        resolve()
    }, 5000)
  })
}

async function sendTelegram(name_long, img=null){
  if (img != null){
    var img_url = wcUrl1
    var img_path = '/tmp/urlCam-' + dayjs(new Date()).format('YYMMDD-HHmmssSSS')  + '.jpg'
    await downloadImage(name_long,img_url,img_path)
    //console.log(getTime() + '' + scene + ': Telegram image sent ' + name_long + ' ' + img_path)
    bot.sendPhoto(tgMsgId, img_path,{caption : name_long + '\n ' + dayjs(new Date()).format('HH:mm:ss.SSS')})
  } else {
    //console.log(getTime() + '' + scene + ': Telegram sent ' + name_long.substring(0, name_long.indexOf('\n')))
    bot.sendMessage(tgMsgId, name_long + ' ' + dayjs(new Date()).format('HH:mm:ss.SSS'))
    //bot.sendMessage(tgMsgId, name_long ' ' + dayjs(new Date()).format('HH:mm:ss.SSS'))
  }
}

// starting 
console.log(getTime() + chalk.green('Starting ...'))

// connect to all mqtt topics
mqttClient.on('connect', function() {
  for (const device of devices.devices) {
    if (device.telegram) {
      mqttClient.subscribe(device.mqtt, function (err) {
        if (err) {
          console.error(getTime() + 'mqtt: Error subscribing to ' + device.name + ',' + err);
        } else {
          console.log(getTime() + 'mqtt: Connected to ' + device.name);
        }
      });
    }
  }
})

mqttClient.on('message', function (topic, payload) {
  let jsonObj = '';
  //console.log(getTime() + 'mqtt: Topic ' + topic.toString() + ', Payload ' + payload.toString())

  try {
    jsonObj = JSON.parse(payload);
    // console.log('Payload JSON: ' + JSON.parse(payload));
  } catch (error) {
    // console.log(getTime() + 'Payload no jsonObj ' + payload)
    // console.log('Payload not JSON');
  }

  if (/^muh\/portal\/.+/.test(topic)) {
    if (/\/(json)$/.test(topic)) {
      if(typeof jsonObj.state == 'number' && !isNaN(jsonObj.state) && Number.isInteger(jsonObj.state) &&
         typeof jsonObj.state !== "undefined" && jsonObj.state !== null && jsonObj.state !== ""){
        if (topic.toString().split('/')[2] === 'HDB'){
          sendTelegram('Portal: ' + topic.toString().split('/')[2] + ' ' + jsonObj.state.toString(), 1)
        } else {
          sendTelegram('Portal: ' + topic.toString().split('/')[2] + ' ' + jsonObj.state.toString())
        }
      }
      // RFID uid
      if(typeof jsonObj.uid !== "undefined" && jsonObj.uid !== null && jsonObj.uid !== ""){
        sendTelegram('RFID: ' + topic.toString().split('/')[2] + ' ' + jsonObj.uid.toString())
      }
    }
  }

  // em3
  if (/^shellies\/shellyem3\/emeter\/0\/.+/.test(topic)) {
    if (/\/power$/.test(topic.toString())) {
      if (payload.toString() > 2800) {
        sendTelegram('EM3: ' + topic.toString().substring(topic.toString().lastIndexOf('/') + 1) + ' ' + payload.toString())
      }
    }
  }
  
})



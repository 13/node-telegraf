# node-telegraf

* mqttwrappr
    A simple **MQTT** wrapper to filter sensor data from multiple esp32-cc1101 receivers
  
* telegrafr
    Save sensor data to **InfluxDB**
    
* telegramr
    Send sensor data to **Telegram**


### Run
```
pm2 start mqttwrappr.mjs
pm2 start telegrafr.mjs
pm2 start telegramr.mjs
```

### Auto Start at System Boot

```
pm2 startup
pm2 save
```

### Status

```
pm2 list
pm2 logs 
```

# node-telegraf

* mqttwrappr
        A simple **MQTT** wrapper to filter sensor data from multiple esp32-cc1101 receivers
* telegrafr
        Save sensor data to **InfluxDB**
* telegramr
        Send sensor data to **Telegram**
* telegrafr-pv
        Save sensor PV data to **InfluxDB**


### Run
```
pm2 start mqttwrappr.mjs
pm2 start telegrafr.mjs
pm2 start telegramr.mjs
pm2 start telegrafr-pv.mjs
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

### Logs 
```
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```

/* InfluxDB v2 */
const url = process.env['INFLUX_URL'] || 'http://192.168.22.99:8086'
const token = process.env['INFLUX_TOKEN'] || 'asdf'
const org = process.env['INFLUX_ORG'] || 'org'
const bucket = 'muh'
const username = 'my-user'
const password = 'my-password'

export {url, token, org, bucket, username, password}

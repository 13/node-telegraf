#!/bin/bash
#
#
# Delete measurement ie wrong datatype float int

#
TOKEN=$(grep -o "influxToken *= *process.env\['INFLUX_TOKEN'\] *|| *'[^']*'" "env.mjs" | awk -F"'" '{print $4}')

influx delete --bucket muh --org muh \
  --token $TOKEN \
  --start '1970-01-01T00:00:00Z' \
  --stop $(date +"%Y-%m-%dT%H:%M:%SZ") \
  --predicate '_measurement="illuminance"'

# --predicate '_measurement="example-measurement" AND exampleTag="exampleTagValue"'

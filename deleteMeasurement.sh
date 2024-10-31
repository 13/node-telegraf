#!/bin/bash
#
#
# Delete measurement ie wrong datatype float int
# CEST -2 hours

#
TOKEN=$(grep -o "influxToken *= *process.env\['INFLUX_TOKEN'\] *|| *'[^']*'" "env.mjs" | awk -F"'" '{print $4}')

influx delete --bucket muh --org muh \
  --token $TOKEN \
  --start '2024-09-03T05:59:00Z' \
  --stop '2024-09-03T05:59:59Z' \
  --predicate '_measurement="temperature" AND node="HZ_WW"'

  #--stop $(date +"%Y-%m-%dT%H:%M:%SZ") \
  #--predicate '_measurement="temperature" AND node="HZ_WW"'

# --predicate '_measurement="example-measurement" AND exampleTag="exampleTagValue"'
#
# influx delete --bucket muh --org muh \
#   --token $TOKEN \
#   --start '1970-01-01T00:00:00Z' \
#   --stop $(date +"%Y-%m-%dT%H:%M:%SZ") \
#   #--predicate '_measurement="temperature"'
# # --predicate '_measurement="example-measurement" AND exampleTag="exampleTagValue"'

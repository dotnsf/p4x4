#!/bin/bash

# Download dotnsf/hatoya:latest
docker pull dotnsf/hatoya:latest

# Create docker network
docker network create hatoya-network

# Create 3 nodes(server1, server2, and server3) with different parameters on docker network
docker run -e PORT=14126 -e SECRET=hatoya1 --name hatoya1 --network hatoya-network -d -p 14126:14126 dotnsf/hatoya

docker run -e PORT=24126 -e SECRET=hatoya2 --name hatoya2 --network hatoya-network -d -p 24126:24126 dotnsf/hatoya

docker run -e PORT=34126 -e SECRET=hatoya3 --name hatoya3 --network hatoya-network -d -p 34126:34126 dotnsf/hatoya

docker ps

# Check serverid values for server1, server2 and server3
SERVERID1=`curl -XGET 'http://localhost:14126/api/serverid'| jq -r '.serverid'`

SERVERID2=`curl -XGET 'http://localhost:24126/api/serverid'| jq -r '.serverid'`

SERVERID3=`curl -XGET 'http://localhost:34126/api/serverid'| jq -r '.serverid'`

# Create network config connect from server1 to server2(realtime)
curl -XPOST 'http://localhost:14126/api/config' -d '{"name":"config1-1","url":"http://hatoya2:24126"}' -H 'Content-Type: application/json'

sleep 1s

# Create network config connect from server1 to server3(realtime)
curl -XPOST 'http://localhost:14126/api/config' -d '{"name":"config1-2","url":"http://hatoya3:34126"}' -H 'Content-Type: application/json'

sleep 1s

# Create network config connect from server2 to server3(cron)
#curl -XPOST 'http://localhost:24126/api/config'  -H 'Content-Type: application/json' -d '{"name":"config2-1","url":"http://hatoya3:34126","cron":"* * * * *"}'
# Create network config connect from server2 to server3(realtime)
curl -XPOST 'http://localhost:24126/api/config'  -H 'Content-Type: application/json' -d '{"name":"config2-1","url":"http://hatoya3:34126"}'

sleep 1s

# Create network config receive from server1 to server2
curl -XPOST 'http://localhost:24126/api/config' -H 'Content-Type: application/json' -d @- <<EOS 
{"name":"config2-2","serverid":"${SERVERID1}"} 
EOS

sleep 1s

# Create network config receive from server1 to server3
curl -XPOST 'http://localhost:34126/api/config' -H 'Content-Type: application/json' -d @- <<EOS 
{"name":"config3-1","serverid":"${SERVERID1}"} 
EOS

sleep 1s

# Create network config receive from server2 to server3
curl -XPOST 'http://localhost:34126/api/config' -H 'Content-Type: application/json' -d @- <<EOS 
{"name":"config3-2","serverid":"${SERVERID2}"} 
EOS

sleep 1s

# Create db1 on server1
curl -XPOST 'http://localhost:14126/api/db1'

sleep 1s


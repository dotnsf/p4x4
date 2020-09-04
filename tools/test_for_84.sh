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

# Check serverid values for server1 and server2
SERVERID1=`curl -XGET 'http://localhost:14126/api/serverid'| jq -r '.serverid'`

SERVERID2=`curl -XGET 'http://localhost:24126/api/serverid'| jq -r '.serverid'`

# Create db1 on server1
curl -XPOST 'http://localhost:14126/api/db1'

sleep 1s

# Create network config to connect server3 on server1
curl -XPOST 'http://localhost:14126/api/config' -d '{"name":"config1","url":"http://hatoya3:34126"}' -H 'Content-Type: application/json'

sleep 1s

# Create db2 on server2
curl -XPOST 'http://localhost:24126/api/db2'

sleep 1s

# Create network config to connect server3 on server2
curl -XPOST 'http://localhost:24126/api/config' -d '{"name":"config2","url":"http://hatoya3:34126"}' -H 'Content-Type: application/json'

sleep 1s

# Create db2 on server3
curl -XPOST 'http://localhost:34126/api/db3'

sleep 1s

# Create network config to receive sync request from server1 to server3
curl -XPOST 'http://localhost:34126/api/config' -H 'Content-Type: application/json' -d @- <<EOS 
{"name":"config3-1","serverid":"${SERVERID1}"} 
EOS

sleep 1s

# Create network config to receive sync request from server2 to server3
curl -XPOST 'http://localhost:34126/api/config' -H 'Content-Type: application/json' -d @- <<EOS 
{"name":"config3-2","serverid":"${SERVERID2}"} 
EOS

sleep 1s

# Post a record into server1
curl -XPOST 'http://localhost:14126/api/db1/new' -H 'Content-Type: application/json' -d @- <<EOS 
{"name":"name1","age":1} 
EOS

sleep 1s

# Post a record into server2
curl -XPOST 'http://localhost:24126/api/db2/new' -H 'Content-Type: application/json' -d @- <<EOS
{"name":"name2","age":2} 
EOS

sleep 1s

# Reset server2
curl -XPOST 'http://localhost:24126/api/reset' -H 'accept: application/json' -H @- <<EOS
serverid: ${SERVERID2}
EOS

sleep 1s

# Restore server2 from server3
curl -XPOST 'http://localhost:24126/api/restore' -d '{"url":"http://hatoya3:34126"}' -H 'Content-Type: application/json' -H 'accept: application/json' -H @- <<EOS
serverid: ${SERVERID2}
EOS 

#!/bin/bash

# docker stop $(docker ps -q) | docker rm
#CONIDS=$(docker ps -q)

#sleep 1s

#docker stop $(CONIDS)

#sleep 1s

#docker rm $(CONIDS)

# Stop all running server node
docker stop $(docker ps -q)

sleep 1s

# Remove docker network
docker network rm hatoya-network




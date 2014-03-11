---
layout: post
title: "SSH into Docker containers by name"
category: posts
---
I hacked together an SSH proxy so that you can direct SSH into docker containers using their name. It's on [github](https://github.com/henrik-muehe/docker-ssh), excerpt from the README:

[**docker-ssh**](https://github.com/henrik-muehe/docker-ssh)

Allows connecting to all your local docker containers using ssh simply like this:

	ssh container-name.docker

if container-name is the name of the container and ssh is running in it. Automatically install for the current user using

	curl -s https://raw.github.com/henrik-muehe/docker-ssh/master/install | /bin/bash

...
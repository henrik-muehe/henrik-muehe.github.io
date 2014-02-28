---
layout: post
title: "Switching Docker from aufs to devicemapper"
category: posts
---
We use [Docker](http://docker.io) for various teaching webservices ([Codematch](http://codematch.muehe.org), [Xquery](http://xquery.muehe.org), [Datalog](http://datalog.muehe.org)) we want to offer to students but which should not cause our webserver to be more exposed. Docker has been good so far and we have already used the architecture to migrate all containers from the original dev host to the production webserver host. Here, we'll talk about switching from AUFS to Devicemapper as a storage backend.

Why device mapper?
------------------

I can not attest to either storage backend being strictly better or worse than the other. However, for us the benefit is being able to run IBM DB2 without resorting to mounting an external volume for the DB2 container. This is beneficial, as using external storage break the versioned architecture of docker while keeping all data inside the container's filesystem yields a nice separation of concerns.

1) Exporting all important images
---------------------------------

We first committed each image we care for so that we had the most recent version tagged somewhere with all changes included. This can be done roughly like this

	docker ps -a
	# for each container you care for, stop and then commit it
	docker commit e198aac7112d export/server1 
	docker commit a312312fddde export/server2

Then, we saved each image to a tar archive using the `docker save` command. Beware that docker save streams the tarred and gzipped output to stdout so you better redirect it into a file like so:

	docker save export/server1 > export_server1.tar.gz
	docker save export/server2 > export_server2.tar.gz

This gives you loadable copies of each of your important images. Alternatively, you could also export the container using export and import but I had less success with this: import failed to load a 1500MB export (I killed it after 15 hours of "importing"). Your milage may vary.

2) Switching storage backends
-----------------------------

On ubuntu, this is simple. You want to add an argument to the docker deamon when it's launched on system startup. Storage selection is done using the `--storage-driver=x` flag. AUFS seems to be the default so I changed `/etc/default/docker` to enable device mapper:

	# Use DOCKER_OPTS to modify the daemon startup options.
	DOCKER_OPTS="--storage-driver=devicemapper"

and restarted docker. With this, all containers and images should be gone (as there are none in devicemapper storage, if you removed the command line options, you'd see everything again). Now we import the original images like this:

	docker load < export_server1.tar.gz
	docker load < export_server2.tar.gz

This should actually allow you to start each image just like before except that you are running using the device mapper backend now. Of course, once you are confident that everything works as expected, you can get rid of the original images and containers stored in AUFS.
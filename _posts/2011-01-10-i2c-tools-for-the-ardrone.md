---
layout: post
title: "I2C Tools for the AR.Drone"
category: posts
---
As I've mentioned before, I've done some investigation concerning the i2c bus on the ar.drone. I just wanted to share the i2c tools used to probe the bus and a couple of results with you real quick. A link to the tools compiled for the drone can be found at the end of this post. Probing the two i2c busses yields the following results:


	# i2cdetect -y 0
	     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
	00:          -- -- -- -- -- -- -- -- -- -- -- -- --
	10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	40: -- -- -- -- -- -- -- -- -- 49 -- -- -- -- -- --
	50: 50 -- -- -- -- -- -- -- -- -- -- -- -- 5d -- --
	60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	70: -- -- -- -- -- -- -- --
	# i2cdetect -y 1
	     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
	00:          -- -- -- -- -- -- -- -- -- -- -- -- --
	10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	20: -- 21 -- -- -- -- -- -- -- -- -- -- -- -- -- --
	30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	40: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
	70: -- -- -- -- -- -- -- --

i2c 0, address 5d is the bottom camera
i2c 0, address 50 is the 24C32WI eeprom

The rest is unknown to me so far. I've not tried to dump the eeprom for fear of accidentally overwriting it, I will probably pull up it's read only pin and give it a shot at some point though. :-)

Files:
[i2ctools (arm binaries)](/downloads/drone/i2ctools-arm.tar.gz)

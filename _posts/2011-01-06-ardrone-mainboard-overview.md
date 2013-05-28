---
layout: post
title: "AR.Drone mainboard overview"
category: posts
---
Top view (side with ground camera)
----------------------------------

![Top view](/images/drone/top.png)

	1: Camera, I2C bus 0 address 5d
	2: I2C connectors for I2C Bus 0 arrive here
	3: DRAM cache
	4: Connector to navigation board, at least one serial port
	5: USB driver SMSC USB3317
	6: Connector to front camera, probably not an I2C device
	7: External connection port with TTYS0 serial port and USB port
	8: ROCm Atheros AR6102G-BM2D wireless
	9: Power supply for the engines
	10: Ground
	11: VCC +5V


Bottom view
-----------
![Bottom view](/images/drone/bottom.png)

	A: Power supply for the engines
	B: Connector to the engine-boards
	C: I2C Bus (data)
	D: I2C Bus (clock)
	E: 5V
	F: Ground
	G: I2C EEPROM CSI 24C32WI, i2c bus0, address 50

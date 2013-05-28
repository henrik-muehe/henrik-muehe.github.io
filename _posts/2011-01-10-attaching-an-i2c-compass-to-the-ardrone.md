---
layout: post
title: "Attaching an I2C compass to the AR.Drone"
category: posts
---
I've recently attached a magnetic compass to the drone using the i2c bus. Let me start by saying that a good compass is not exactly cheap, I paid about 25€ for it and I've seen it being sold for over 100€ so it's an expensive toy. Also, from what I've gathered, it's really hard to find a good position for it on the drone seeing as all the motors have a strong magnetic field. Right now, my drone isn't exactly flyable but I will share my experience with the additional sensor nonetheless, even though I have not found an ideal spot to place it at yet.

The compass chip I've attached is an HMC6352 ([datasheet](http://www.sparkfun.com/datasheets/Components/HMC6352.pdf), [link to breakout board supplier](https://www.sparkfun.com/products/7915)) by Honeywell mounted on a breakout board (very necessary if you are not a soldering pro). I've attached VCC and ground to the two pins carrying those current marked 10 and 11 in my previous post about the mainboard layout. The two i2c wires were attached to what I labeled C and D in said post. To be exact, I chose to attach the sensor to the i2c bus solder joints in the middle of the board, not next to the i2c eeprom; it was really easy to solder the cables on, no protective varnish of any kind. My warranty is probably void now, though. If you don't want to risk voiding your warranty I suggest glueing something onto those pins also I can not imagine that being a really solid connection. In a worst case scenario it's probably easiest if you swap the mainboard out for a replacement part and send the device in for warranty after that ;-)

The sensor is not attached to the same bus the firmware is using for the ground camera, an eeprom and another device I have yet to identify. I have not done excessive testing put I am able to poll the sensor while the firmware is operating so that seems to be a good sign. I slapped together a very small test program to retrieve the current heading from the sensor:

{% highlight c linenos %}
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/time.h>
#include "i2c-dev.h"
#define ADDRESS 0x21
int fd;
int main(int argc, char *argv[]) {
  fd = open( "/dev/i2c-0", O_RDWR );
  if( ioctl( fd, I2C_SLAVE, ADDRESS ) < 0 )
  {
    fprintf( stderr, "Failed to set slave address: %m\n" );
    return 2;
  }
  if( i2c_smbus_write_byte( fd, 'A' ) < 0 )
    fprintf( stderr, "Failed to write 'A' to I2C device: %m\n" );
  usleep(10);
  unsigned result = i2c_smbus_read_word_data(fd, 0);
  unsigned upper = result >> 8 & 0x00FF;
  unsigned lower = result & 0x00FF;
  printf("%u\n", (lower << 8) | upper);
  return 0;
}
{% endhighlight %}

So the sensor is attached and working. I will update this as soon as I figure out a good location for the sensor on the drone :-)

Downloads:

[compass.c](/downloads/drone/compass.c)
[compass binary](/downloads/drone/compass)

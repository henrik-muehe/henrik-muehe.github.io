#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/time.h>
//#include <linux/i2c.h>
//#include <linux/i2c-dev.h>
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

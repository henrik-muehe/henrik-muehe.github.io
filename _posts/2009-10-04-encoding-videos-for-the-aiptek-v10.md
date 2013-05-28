---
layout: post
title: "Encoding videos for the Aiptek V10"
category: posts
---

<img class="pull-right" style="margin-left:20px; max-width:100%; width:20%" alt="Airptek Beamer" src="/images/aiptek.jpg" /></a>

About two weeks ago I felt the need to try out the [Aiptek V10 LED Micro Projector](http://www.aiptek.com/) and it actually sucks a lot less than I thought. I am still thinking about selling it again but it was a nice thing to play with and it fulfilled its purpose.


What I found to be very problematic is encoding videos for the aiptek with my mac (same problem with linux or other unix-based systems I guess). There are a couple of pitfalls and it took me about 5 hours to figure every detail out so don't waste as much time as I did and try what I came up with!

I used mencoder and ffmpeg to create working mp4 containers. Mencoder is able to add black bars to your movies; the aiptek will not play anything other than a movie which is exactly 640x480 in size, you can not just adjust the width to 640. I use ffmpeg after adjusting the video size to get a correct audio stream. I haven't quite figured out why mencdoers ac3 doesn't play on the v10 but a quick run of ffmpeg to adjust the audio stream works quite well and doesn't take too long. All in all I came up with the following:

Software:
	mencoder using macports ("sudo port install mplayer-devel +faac +x264 +xvid")
	ffmpeg using macports ("sudo port install ffmpeg")
Commands used:
	mencoder "$file" -sws 9 -of avi -ovc lavc -lavcopts \
	  vcodec=mpeg4:vbitrate=300 -o "$file-temp" \
	  -vf scale=640:-2,expand=640:480:0:0:1::,harddup -oac faac -faacopts br=64:object=2:mpeg=4 \
	  -srate 44100 -channels 2 -ofps 25 -ffourcc DIVX -noodml

	ffmpeg -i "$file-temp" -s 640x480 -b 800k -acodec libfaac -ab 64 -vcodec mpeg4 -vtag divx "$outfile"
 The first command resizes the video stream and changes formats, the second run "fixes" audio. Now I am not sure why this is necessary but it works for me and it is resonably fast. You can also make a small script out of it:

	#!/bin/bash

	file=$1
	outfile=${file%.[^.]*}

	mencoder "$file" -sws 9 -of avi -ovc lavc -lavcopts \
	vcodec=mpeg4:vbitrate=300 -o "$outfile-temp-aiptek.mp4" \
	-vf scale=640:-2,expand=640:480:0:0:1::,harddup -oac faac -faacopts br=64:object=2:mpeg=4 \
	-srate 44100 -channels 2 -ofps 25 -ffourcc DIVX -noodml

	ffmpeg -i "$outfile-temp-aiptek.mp4" -s 640x480 -b 800k -acodec libfaac -ab 64 -vcodec mpeg4 -vtag divx "$outfile-aiptek.mp4"
	rm "$outfile-temp-aiptek.mp4"

This script encodes the video given as first parameter for the aiptek not changing the original and creating a new file with -aiptek as suffix.

Hope this helps someone out there; I'd really love to hear from you if it did or if you have improved my approach!

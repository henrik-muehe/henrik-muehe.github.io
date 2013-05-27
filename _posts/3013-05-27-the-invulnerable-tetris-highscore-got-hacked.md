---
layout: post
title: "The Invulnerable Highscore? Hacked!"
category: posts
---

<span class="pull-right"><a href="/images/highscore_hack.png"><img style="margin-left:20px; margin-top:0px" alt="Screenshot of the hacked Tetris Highscore, click to see full screenshot." src="/images/highscore_hack.png" /></a></span>

... and by a python script too, or so I hear.

I was mildly shocked that the youngest member of our team at TUM was able to hack the invulnerable highscore. I bet free lunch on the high score not being hackable easily and I was wrong -- not by design, I just missed to add the most important line of the entire highscore verification mechanism. My bright colleague spotted the mistake while studying the code and -- instead of filing an issue on [Github](https://github.com/henrik-muehe/tetris) -- opted to go for the free lunch instead.

The offending part of the code is the line starting with `throw "CHEATER...` which was missing. All functionality to check whether or not a Tetris-block could actually be placed in the spot reported by the game log was there all along but the trigger was missing.

Still, finding this specific part of the code, especially in the old version where most names were mangled is more than just a job well done. This goes to show that security by obscurity is not a great idea when someone is motivated -- for instance by free lunch. Well done Moritz.

More will follow as the story develops ;-)

<div class="clearfix"></div>
{% highlight coffeescript linenos %}
class Tetris
	run: (log) =>
		...
		p.xb=i[0]
		p.yb=i[1]
		throw "CHEATER DETECTED" if not @check(p)
		@persist(p.bounds(),p.color)
		...
		@score
{% endhighlight %}

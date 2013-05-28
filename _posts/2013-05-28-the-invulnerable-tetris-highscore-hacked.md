---
layout: post
title: "The Invulnerable Highscore? Hacked!"
category: posts
---

<span class="pull-right" style="width:60%"><a href="/images/highscore_hack.png"><img style="margin-left:20px; margin-top:0px; max-width: 100%" alt="Screenshot of the hacked Tetris Highscore, click to see full screenshot." src="/images/highscore_hack.png"/></a></span>

... and by a python script too, or so I hear.

I was mildly shocked that a colleague was able to hack the invulnerable highscore. I bet free lunch on the high score not being hackable easily and I was wrong -- but not by design. I just missed to add the most important line of the entire highscore verification mechanism. My colleague spotted the mistake while studying the code and -- instead of filing an issue on [Github](https://github.com/henrik-muehe/tetris) -- opted to go for the free lunch instead.

The offending part of the code is the line starting with `throw "CHEATER...` which was missing. All functionality to check whether or not a Tetris-block could actually be placed in the spot reported by the game log was there all along but the trigger was missing.

Still, finding this specific part of the code, especially in the old version where most names were mangled is an accomplishment. This goes to show that security by obscurity is not a great idea when someone is motivated -- for instance by free lunch.

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

The details
-----------

The highscore mechanism used logs all final placements of all tetris blocks. Therefore, on the server, the game can be evaluated again and the score can be recomputed. What was missing though is a check of whether there's actually a free slot for the given tetromino or not. Collision checking is done through the `@check` routine. Every tetromino has a bounding box and a position. `@check` determines whether or not the tetromino can be persisted into the game state without a collision. The game state is a 10 by 15 matrix which represents all blocks currently on the game board which do not move anymore.

For example, see the game state matrix obtained by the newly created `@dump` method versus a screenshot of the board here:

<div class="highlight pull-left" style="margin:20px" >
<pre><code>|   bbb    |
|yyoo b    |
|yy o      |
| p o      |
|ppyy      |
|ppyy      |
|ppg       |
|ppgg      |
|pprg      |
|pprr      |
|ppr       |
|p oyy     |
|yyoyy   oo|
|yyoo gg  o|
|ccccgg   o|
|++++++++++|
</code></pre></div>
<img src="/images/highscore_example.png" class="pull-left" style="height:310px; margin:20px"/>
<div class="clearfix"></div>

When a collision check is performed, the bounding box of the tetromino at its final position and the game state matrix are intersected and if the intersection is not empty, the user is identified as a cheater and the score computation is aborted -- at least now.

The loophole should be fixed now and I'll have the aggressor try his trick again later. Once the codebase has stabilized some more I'll up the reward to lunch+desert. Good job, Moritz.

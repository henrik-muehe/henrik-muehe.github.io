---
layout: post
title: "Tetris in roughly 4kb"
category: posts
---

<div style="font-size:20px; margin-bottom:10px"><a href="http://tetris.muehe.org" target="_NEW"><i class="icon-play"></i>&nbsp; Just play tetris</a></div>

First off, I am absolutely not among the [tetris maniacs of this world](http://chrishiggins.com/w/2013/02/03/playing-to-lose/) (the story is a recent HN find). While browsing the stack-exchange network though, I discovered [codegolf](http://codegolf.stackexchange.com/) and browsed for interesting challenges, none of which were to be about roughing up code so much that it would fit into a cache-line. I just finished working 2 1/2 months for the SIGMOD Programming Challenge and -- honestly -- was missing the feeling of competing at something.

<a href="http://tetris.muehe.org/" target="_NEW"><img class="pull-left" style="margin-right:20px;" alt="Tetris Screenshot, click to play!" src="http://i.stack.imgur.com/wfziG.png" /></a>

What I found is the challenge to [reimplement Tetris in less than 4kb](http://codegolf.stackexchange.com/questions/11175/reimplementing-tetris). The description was attractive: No fighting to remove every last superfluous byte from the code but a well-chosen limit inside which one could implement some subset of features and a popularity contest as the winning criterion.

So how do you win this, right?

Well, a language that executes in the browser seems to be an obvious choice. All visitors can quickly launch tetris and play a round. If you first need to get your hands on a BASIC compiler you will probably lose 50% of your potential up-votes from the fact that people can not actually play your implementation unless they are very eager to try it. I used CoffeeScript, first because pure Javascript is very painful and second because CoffeeScript allows much more concise, functional style code.

So at roughly 3.8kib without any length optimizations I had most of the required functionality. Except for some optimizations, I was finished, which completely defeated the point of having a competition to play in. Luckily, I saw a comment of a competitor wanting to do another implementation and decided to implement a highscore. I am a computer scientist, so quite naturally, I wanted to show off to my colleagues and whoever else was willing to open the tetris link. What I did not want though, is someone faking his way on top of the highscore as -- I am sure -- someone would have tried.

The highscore implementation was done using a lightweight node backend to complement the frontend CoffeeScript code. I factored the whole tetris game into a library and included it both on the frontend and on the backend. What happens when you max out is that most of the moves you made during the game (all final placements of all blocks as well as your random number generator seed) are send to the server and the entire game is reevaluated there.

To further drive my more engaged colleagues insane, the client side high score is not send to the server at all, only the computed score is used. This is nonsensical for a product since it makes validating bug reports on the lines of "It said I had 500k but I only have 20k on the high score list!" very difficult -- for my purposes though, it saved a couple of bytes ;-)

During the 4 weeks I had the game on [Nodejitsu](http://nodejitsu.com), someone made it to 1000k points which equals at least 2 hours of constant playing (the game does not become harder over time); as far as I can tell, no one tricked the system. Feel free to try though, a [running version of Tetris](http://tetris.muehe.org/) is hosted on my computer -- sadly I had to reset the highscore.

<a href="http://stackexchange.com/users/85820">
<img src="http://stackexchange.com/users/flair/85820.png" width="208" height="58" alt="profile for Henrik M&#252;he on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for Henrik M&#252;he on Stack Exchange, a network of free, community-driven Q&amp;A sites" style="float:right; margin: 20px;">
</a>

For me, the contest worked out though. First, it was a good replacement for the constant kick I got out of the previous coding challenge, second, the code limit stopped me from implementing too many pointless features and today I am happy to say that I am no longer addicted to coding challenges. Additionally, I have more codegolf flair now than I have on the actual Stackoverflow but this nice combined display here on the right makes it look less like I am a code maniac and more like I am a valuable contributor to the Stackexchange community.


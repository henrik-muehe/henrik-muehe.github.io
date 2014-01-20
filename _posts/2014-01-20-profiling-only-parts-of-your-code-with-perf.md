---
layout: post
title: "Profiling only parts of your code with perf."
category: posts
---
[Perf](https://perf.wiki.kernel.org/index.php/Main_Page) is an excellent tool for profiling linux software. It uses hardware performance counters to give you information on your code's performance. This makes it a very low overhead alternative to -- for instance -- [valgrind](http://valgrind.org/) which uses instrumentation. Both ways of profiling software have their merits but perf is a great tool to just keep running all the time to find severe performance bottlenecks with ease. 

That said, I frequently have to profile only a part of my code. This is due to the fact that I write lots of database benchmarks which frequently load or even generate an initial dataset which they than run queries on. I usually care for query instead of loading performance, therefore I'd like to profile only the query part of my application. This can be done using API calls to the excellent [performance counters C api](http://icl.cs.utk.edu/papi/) but in my case, an easier way of achieving what I need it to use a "perf wrapper". In you code, that wrapper looks like this:

{% highlight cpp %}
// ...
#include "System.hpp"

int main() {
	// ...

	// Load data
	System::profile("loading", [&]() {
		db.insert(1); db.insert(2); ... db.insert(999999); 
	});

	// Run queries
	System::profile("queries", [&]() {
		for (int i=0; i<1000000; ++i) {
			db.query(i);
		}
	});
}
{% endhighlight %}

For each `System::profile` part you will receive a performance counter dump, one named loading.data and one named queries.data. Each contains the samples for the appropriate subset of the code and you can find bottlenecks wihin query execution without also seeing all data which is actually produced by initially loading the database.

Essentially, this code starts perf record on the current process right before it's body is executed and stops perf
right after the body giving you a performance counter sampling of exactly the part of code you are interested in. It is implemented like this:

{% highlight cpp %}
#pragma once

#include <sstream>
#include <iostream>
#include <functional>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <unistd.h>
#include <signal.h>

struct System
{
    static void profile(const std::string& name,std::function<void()> body) {
        std::string filename = name.find(".data") == std::string::npos ? (name + ".data") : name;

        // Launch profiler
        pid_t pid;
        std::stringstream s;
        s << getpid();
        pid = fork();
        if (pid == 0) {
            auto fd=open("/dev/null",O_RDWR);
            dup2(fd,1);
            dup2(fd,2);
            exit(execl("/usr/bin/perf","perf","record","-o",filename.c_str(),"-p",s.str().c_str(),nullptr));
        }

        // Run body
        body();

        // Kill profiler  
        kill(pid,SIGINT);
        waitpid(pid,nullptr,0);
    }

    static void profile(std::function<void()> body) {
        profile("perf.data",body);
    }
};
{% endhighlight %}

You can take a look at your results by executing either `perf report -i loading.data` or `perf report -i queries.data` depending on which part you are interested in.

Of course, this only works and looks this good if you use C++11 but who would want to use anything less.
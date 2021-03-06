CHECK=✔
HR=\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#

build:
	@echo "${HR}"
	@echo "Building UP assets..."
	@echo "${HR}"
	@cat /dev/null > css/up.css
	@recess --compress _assets/up.less >> css/up.css
	@echo "Compiling and Compressing Less and CSS files with Recess... ${CHECK} Done"
	@cat _assets/bootstrapjs/* > js/up.js.tmp
	@echo >> js/up.js.tmp
	@cat _assets/up.js >> js/up.js.tmp
	@cat _assets/instantclick.min.js >> js/up.js.tmp
	@cat _assets/sharrre/jquery.sharrre-1.3.4.js >> js/up.js.tmp
	@uglifyjs  js/up.js.tmp > js/up.js
	@rm -rf js/up.js.tmp
	@echo "Compiling and Compressing JS files with uglify-js... ${CHECK} Done"
	@echo "${HR}"
	@echo "UP successfully built."
	@echo "${HR}"
	@echo "<3 @caarlos0"


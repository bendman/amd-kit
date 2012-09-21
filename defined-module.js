define(
	'defined-module.js',
	['domReady'],
	function() {
		var message = function(msg) {
			alert('Msg Using Defined Module: ' + msg);
		};

		message('defined module fired!');
		return message;
	}
);
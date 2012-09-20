/**
 * Array.indexOf Polyfill (courtesy of MDN)
 */
if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function(searchElement /*, fromIndex */ ) {
		if (this === null) {
			throw new TypeError();
		}
		var t = new Object(this);
		var len = t.length >>> 0;
		if (len === 0) {
			return -1;
		}
		var n = 0;
		if (arguments.length > 0) {
			n = Number(arguments[1]);
			if (n != n) { // shortcut for verifying if it's NaN
				n = 0;
			} else if (n !== 0 && n != Infinity && n != -Infinity) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}
		if (n >= len) {
			return -1;
		}
		var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
		for (; k < len; k++) {
			if (k in t && t[k] === searchElement) {
				return k;
			}
		}
		return -1;
	};
}

(function(window, document){
	var buildFile,
		Modules = new ModulesList();

/**
 * ModulesList (Constructor)
 *
 * Basically where the AMD magic happens
 */
	function ModulesList() {
		this._modules = {}; // module: [requirements]
		this._reqs = {}; // requirement: [modules]
		this._requires = 0;
	}
	ModulesList.prototype.add = function(module, reqs, callback) {
		var i,
			self = this;

		if (typeof reqs === 'string') reqs = [reqs];
		if (!(reqs instanceof Array)) reqs = [];
		if (module in this._modules && 'executed' in this._modules[module]) return false;

		if (module === undefined) {
			module = 'Require_' + this._requires++;
		}

		this._modules[module] = {
			'executed': false,
			'value': callback,
			'requirements': reqs
		};
		this._reqs[module] = this._reqs[module] || [];

		i = reqs.length;
		while (i--) {
			this._reqs[reqs[i]] = this._reqs[reqs[i]] || [];
			this.include(reqs[i], executor(reqs[i]));
			if (this._reqs[reqs[i]].indexOf(module) === -1) this._reqs[reqs[i]].push(module);
		}

		this.execute(module);

		function executor(module) {
			return function() {self.execute(module);};
		}
	};
	ModulesList.prototype.getRequirements = function(module) {
		var results = [],
			result,
			modReqs = this._modules[module].requirements || [],
			i = modReqs.length;

		while (i--) {
			if (modReqs[i] in this._modules && this._modules[modReqs[i]].executed !== true) {
				return false;
			} else if (modReqs[i] in this._modules) {
				results.push(this._modules[modReqs[i]].value);
			}
		}
		return results;
	};
	ModulesList.prototype.execute = function(module) {
		var results,
			i = this._reqs[module].length,
			storedModule = this._modules[module],
			reqs = this.getRequirements(module);

		if (!reqs || storedModule.executed === true) return false;

		if (typeof storedModule.value === 'function') {
			storedModule.value = storedModule.value.apply(storedModule.value, reqs);
		} else storedModule.value = undefined;

		storedModule.executed = true;
		
		while (i--) {
			this.execute(this._reqs[module][i]);
		}
	};
	ModulesList.prototype.include = function(module, executor) {
		var script = document.createElement('script'),
			firstScript = document.getElementsByTagName('script')[0],
			loaded,
			Modules = this;

		//for not duplicating script tags
		if (typeof this._modules[module] === 'object' && !this._modules[module].script) return true;
		this._modules[module] = {};

		script.type = 'text/javascript';
		script.async = true;
		script.onreadystatechange = script.onload = function(e) {
			if (!loaded && (!this.readyState || this.readyState === 'complete' || this.readyState === 'loaded')) {
				this.onreadystatechange = null;
				loaded = 1;
				executor();
			}
		};
		script.src = module;
		this._modules[module].script = firstScript.parentNode.insertBefore(script, firstScript);
	};

/**
 * Extend Global scope with:
 */

/**
 * require
 * 
 * AMD-esque require function
 * 
 * @param  {Array||String}  reqs
 *         A list of strings for dependencies
 * @param  {Function}  callback  Optional
 *         function to perform after dependencies are loaded
 * @return {undefined}
 */
	window.require = function(reqs, callback) {
		Modules.add(undefined, reqs, callback);
	};

/**
 * define
 * 
 * AMD-esque define function
 * 
 * @param  {String} id
 *         filename of included file
 * @param  {Array} reqs
 *         list of module dependencies
 * @param  {Function} module
 *         callback that returns the module object
 * @return {undefined}
 */
	window.define = function() {
		Modules.add.apply(Modules, arguments);
	};

}(window, document));
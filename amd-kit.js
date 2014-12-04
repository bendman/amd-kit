// 
// # AMD-Kit
// 
// The MIT License (MIT)
// Copyright (c) 2012 Real Magnet, LLC
// 
(function(window, document){
    // Array.indexOf Polyfill (courtesy of MDN)
    if(!Array.prototype.indexOf){Array.prototype.indexOf=function(a){if(this===null){throw new TypeError}var b=new Object(this);var c=b.length>>>0;if(c===0){return-1}var d=0;if(arguments.length>0){d=Number(arguments[1]);if(d!=d){d=0}else if(d!==0&&d!=Infinity&&d!=-Infinity){d=(d>0||-1)*Math.floor(Math.abs(d))}}if(d>=c){return-1}var e=d>=0?d:Math.max(c-Math.abs(d),0);for(;e<c;e++){if(e in b&&b[e]===a){return e}}return-1}}

    // ## Public Methods
    var Modules = {
        // Set AMD configs (a require-like shim config).
        config: configModuleHandler,
        // Define a new module.
        define: handleModule,
        // Require modules inline.
        require: function(deps, callback) {
            handleModule(undefined, deps, callback);
        },
        // Manually trigger a module as resolved.
        execute: function(module) {
            attemptExecute(module, true);
        },
        add: handleModule
    };

    // Add a backdoor through require to access other methods.
    Modules.require.methods = Modules;

    // Make primary methods public.
    window.define = Modules.define;
    window.require = Modules.require;


    // ## Storage variables
    var modules = {}; // track modules
    var allDeps = {}; // track dependencies
    var anonymousCount = 0; // counter for anonymous module IDs
    var config = {}; // store entire config, for extensibility
    var shim = {}; // shim dependencies and exports
    var paths = {}; // proxy paths/nicknames

// 
// ## handleModule
// 
// The base functionality starts here.  This is where incoming modules
// go for registration and dependency checks.
    function handleModule(module, deps, callback, isShim) {
        var i;

        module = attachType(module);

        if (typeof deps === 'string') deps = [deps];
        if (!(deps instanceof Array)) deps = [];
        if (module in modules && 'resolved' in modules[module])
            return false;

        if (module === undefined) {
            module = '_Anonymous_' + anonymousCount++;
        }

        // Track module status and properties.
        modules[module] = {
            'resolved': false,
            'value': callback,
            'dependencies': deps,
            'built': (!deps.length && !callback) ? true : false,
            'shimDepsWaiting': isShim
        };
        allDeps[module] = allDeps[module] || [];

        // Loop through dependencies to register them
        i = deps.length;
        while (i--) {
            if (!deps[i]) continue;
            // Account for type prefixing like `json!`.
            deps[i] = attachType(deps[i]);
            allDeps[deps[i]] = allDeps[deps[i]] || [];
            if (shim[deps[i]]) {
                // Shimmed dependencies, so load handle dependencies first.
                handleModule(deps[i], shim[deps[i]].deps, depsLoaded(deps[i], executor(deps[i])), true);
            } else {
                // Attempt to load the dependency.
                loadModule(deps[i], executor(deps[i]));
            }
            // Register a new dependency.
            if (allDeps[deps[i]].indexOf(module) === -1) {
                allDeps[deps[i]].push(module);
            }
        }

        // Maybe the module _has_ all dependencies, so try it.
        if (typeof callback === 'function') attemptExecute(module);

        // Closure functions to pass around as an executor for this module.
        function executor(module) {
            return function() {
                modules[module].shimDepsWaiting = false;
                attemptExecute(module);
            };
        }
        function depsLoaded(req, callback) {
            return function() {
                loadModule(req, callback);
            };
        }
    }
    // ## Get Dependencies
    // Return an array of module dependencies, or false if any are not yet
    // resolved.
    function getDependencies(module) {
        var results = [];
        var deps = modules[module].dependencies || [];
        var i = deps.length;

        // **Loop through each dependency.**
        while (i--) {
            if (deps[i] in modules && modules[deps[i]].resolved !== true) {
                // Module not yet registered or not yet resolved.
                return false;
            } else if (deps[i] in modules) {
                // Module is resolved, so add the return value to the buffer.
                results.unshift(modules[deps[i]].value);
            }
        }
        return results;
    }

    // ## Attempt Execute
    // If a module's dependencies are resolved, execute the module
    // and capture the value.  Next, attempt the same on 'parent' dependencies,
    // because that might be the last dependency they needed.
    function attemptExecute(module, forced) {
        var results;
        var i = allDeps[module].length;
        var storedModule = modules[module];
        var moduleDeps = getDependencies(module); // check dependencies

        if (!moduleDeps || storedModule.resolved === true) {
            // Not all dependencies are resolved, or this was resolved already. 
            return false;
        }

        if (typeof storedModule.value === 'function') {
            // Execute function modules with dependencies as arguments.
            storedModule.value = storedModule.value.apply(storedModule.value, moduleDeps);
            storedModule.built = true;
        } else if (shim.hasOwnProperty(module) && shim[module].exports) {
            // Module has a global export shim, so grab the export value.
            storedModule.value = window[shim[module].exports];
            storedModule.built = true;
        } else if (forced) {
            // Force resolution of the module, from the public `.execute()` 
            storedModule.built = true;
        }

        if (!storedModule.shimDepsWaiting) {
            storedModule.resolved = true;
        }
        
        while (i--) {
            attemptExecute(allDeps[module][i]);
        }
    }
    // ## Load Module
    // Build a script tag or execute an XHR call for a module, unless the tag
    // has already been built.
    function loadModule(module, executor) {
        // For not duplicating script tags, register the tag as built.
        if (typeof modules[module] !== 'object') {
            modules[module] = {built:true};
        } else if (modules[module].built) {
            // Already built, so return.
            return true;
        } else {
            modules[module].built = true;
        }

        if (module.type === 'script') {
            // Standard types are script tags, injected into the DOM.
            var script = document.createElement('script');
            var firstScript = document.getElementsByTagName('script')[0];
            var loaded;

            // Inject the script tag.
            script.type = 'text/javascript';
            script.async = true;
            script.onreadystatechange = script.onload = function(e) {
                var state = this.readyState;
                if (!loaded && (!state || state === 'complete' || state === 'loaded')) {
                    this.onreadystatechange = null;
                    loaded = 1;
                    // Script loaded, so attempt to resolve the module..
                    executor();
                }
            };
            script.src = module;
            firstScript.parentNode.insertBefore(script, firstScript);
        } else if (module.type === 'json') {
            // `json!` file prefixes are JSON GET requests using XHR.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', module, true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState != 4 || xhr.status != 200) return;
                // Parse response JSON.
                if (xhr.responseText) modules[module].value = JSON.parse(xhr.responseText);
                else modules[module].value = {};
                // JSON loaded, so attempt to resolve the module.
                executor();
            };
            // Attach any `onXhr` configs to the XHR request.
            if (config.onXhr) config.onXhr.call(Modules, xhr, module.toString());
            xhr.send();
        }
    }

    // ## Attach Type
    // Create a complex String object to attach a type property, based on a
    // prefix (eg, 'json!/foo/bar')
    function attachType(module) {
        if (!module || !module.split) return module;
        var modgroup = module.split('!').reverse();
        if (paths.hasOwnProperty(modgroup[0])) {
            modgroup[0] = paths[modgroup[0]];
        }
        module = new String(modgroup[0]);
        module.type = modgroup[1] || 'script';
        return module;
    }

    // Configure the AMD Loader
    // Use this for a shim config similar to _RequireJS_
    function configModuleHandler(cfg) {
        paths = cfg.paths || paths;
        shim = cfg.shim;
        config = cfg;

        var i, shimpath;

        for (shimpath in shim) {
            // Handle registering shim configs with path nicknames
            if (!shim.hasOwnProperty(shimpath)) continue;
            if (paths.hasOwnProperty(shimpath)) {
                shim[paths[shimpath]] = shim[shimpath];
                delete shim[shimpath];
                shimpath = paths[shimpath];
            }
            i = shim[shimpath].deps && shim[shimpath].deps.length ? shim[shimpath].deps.length : 0;
            while (i--) {
                if (paths.hasOwnProperty(shim[shimpath].deps[i])) {
                    shim[shimpath].deps[i] = paths[shim[shimpath].deps[i]];
                }
            }
        }
    }

// ## domReady` dependency definition
// add `domReady` dependency to wait until the DOM is ready to manipulate
    Modules.define('domReady');
    var domReady = function() {
        Modules.execute('domReady');
    };
    if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', domReady, false);
        window.addEventListener('load', domReady, false);
    } else {
        document.attachEvent('onreadystatechange', domReady);
        window.attachEvent('onload', domReady);
    }

}(window, document));

/**
 * - encode url
 * - filter notif
 */
(function(oWindow) {
	var DEFAULT_MODULE_CONFIG = "modular.json",
		DEFAULT_MODULE_LOCATION = "modules/",
		MODULAR_SELECTOR = "[data-modular], [modular]",
		DEFAULT_TEMPLATE_SELECTOR = "[data-mod-template], [mod-template]",
		FILE_NAME_EXP = /[^/]+$/,
		JQUERY_PATH = "lib/jquery/jquery-2.0.0.min.js",

		oDoc = oWindow.document,
		ojQuery;

	Modular.STARTING = 0;
	Modular.INITIALIZING = 1;
	Modular.LOADING = 2;
	Modular.PREPARING = 3;
	Modular.FINISHED = 4;
	Modular.FAILED = -1;

	Modular.log = function() {
		console.log.apply(console, arguments)
	};

	/**
	 * Main Singleton class of Modular framework
	 * JavaScript framework designed to load modularized components
	 *       of Web Application built under any other frameworks
	 *  The objective of the framework is modularize source codes such as :
	 *   - JavaScript
	 *   - Styles
	 *   - Templates(html)
	 *   - Images
	 */
	function Modular() {
		this.onReadyCallbacks = [];
		this.$notifCallbacks = [];
		this.state = Modular.STARTING;
		this.srcRoot = undefined;
		this.libSrcName = undefined;
		this.loadedModules = {};
	}

	Modular.prototype = {
		/**
		 *
		 *
		 */
		ready: function(fCallback, injectCallback) {
			var self = this;
			if (fCallback instanceof Array && typeof injectCallback === 'function') {
				modularjs(fCallback, function () {
					var injections = arguments;
					self.ready(function () {
						injectCallback.apply(self, injections);
					});
				});
				return;
			}
			var self = this, result = true;
			if ((fCallback === undefined) && (self.state === Modular.PREPARING)) {
				ojQuery.holdReady(false);
				while (self.onReadyCallbacks && self.onReadyCallbacks.length > 0) {
					fCallback = self.onReadyCallbacks.shift();
					fCallback(self);
				}
			} else if (typeof fCallback === 'function') {
				if ([Modular.LOADING, Modular.LOADING, Modular.STARTING].indexOf(self.state) >= 0) {
					self.onReadyCallbacks.push(fCallback);					
				} else if ([Modular.PREPARING, Modular.FINISHED].indexOf(self.state) >= 0) {
					fCallback(self);
				} else {
					result = false;
				}
			} else {
				result = false;
			}
			return result;
		},
		defer : function () {
			var promise, resolve, reject;
			promise = new Promise(function(rs, rj) {
				resolve = rs;
				reject = rj;
			});
			return {
				resolve : resolve,
				reject : reject,
				promise :promise
			};
		},
		/**
		 * [notify description]
		 * @param  {[type]} notify     [description]
		 * @param  {[type]} expression [description]
		 * @return {[type]}            [description]
		 */
		notify: function(notify, expression) {
			var self = this, configPath, config, notifInfo;
			if (typeof notify === "function") {
				for (configPath in self.loadedModules) {
					config = self.loadedModules[configPath];
					config.notify((function(config, callback) {
						return function(info, ext) {
							info && callback(info, config);
						};
					}(config, notify)), expression);
				}
				self.$notifCallbacks.push({
					"expr": expression,
					"callback": notify
				});
			} else if (notify instanceof Config) {
				config = notify;
				for (var nNotif = 0; nNotif < self.$notifCallbacks.length; nNotif++) {
					notifInfo = self.$notifCallbacks[nNotif];
					config.notify((function(config, callback) {
						return function(info, ext) {
							info && callback(info, config);
						};
					}(config, notifInfo.callback)), notifInfo.expr);
				}
			}
		},

		/**
		 * [loadModElem description]
		 * @param  {[type]} scriptElem [description]
		 * @return {[type]}            [description]
		 */
		loadModElem: function(scriptElem) {
			var self = this,
				moduleConfig = (scriptElem.dataset && scriptElem.dataset.modular) ||
				scriptElem.getAttribute("modular"),
				promLoader;

			Modular.libSrcName = Modular.libSrcName ||
				scriptElem.src && scriptElem.src.match(FILE_NAME_EXP)[0];
			Modular.srcRoot = Modular.srcRoot ||
				scriptElem.src && scriptElem.src.substr(0, scriptElem.src.length - Modular.libSrcName.length);

			if ((moduleConfig !== null) && (self.state === Modular.STARTING)) {
				moduleConfig = moduleConfig || DEFAULT_MODULE_CONFIG;
				promLoader = self.prepareJq(scriptElem).then(function() {
					self.state = Modular.LOADING;
					return self.loadModuleFromConfig(moduleConfig);
				}, function(oError) {
					self.state = Modular.FAILED;
					return Promise.reject("Some dependecies are missing.");
				});
				self.state = Modular.LOADING;
			} else if ((self.state >= Modular.LOADING) && (moduleConfig !== null)) {
				moduleConfig = moduleConfig || DEFAULT_MODULE_CONFIG;
				promLoader = self.loadModuleFromConfig(moduleConfig);
			} else {
				throw new TypeError("Invalid Modular Script Element");
			}
			return promLoader && promLoader.then(function() {
				self.state = Modular.PREPARING;
				self.ready();
				self.state = Modular.FINISHED;
				return self;
			});
		},
		/**
		 * [loadModuleFromConfig description]
		 * @param  {[type]} sConfigPath [description]
		 * @return {[type]}               [description]
		 */
		loadModuleFromConfig: function(sConfigPath) {
			var self = this,
				promise;

			if ((self.state === Modular.LOADING) && !self.loadedModules[sConfigPath]) {
				promise = ojQuery.getJSON(sConfigPath).then(function(oConfig) {
					var config;
					oConfig = oConfig || {};
					oConfig.configName = oConfig.configName ||
						sConfigPath.match(FILE_NAME_EXP)[0];
					oConfig.configRoot = oConfig.configRoot ||
						sConfigPath.substr(0, sConfigPath.length - oConfig.configName.length);

					config = new Config(oConfig, self);
					self.notify(config);
					self.loadedModules[sConfigPath] = config;
					return config.load();
				}, function(oError, errMsg, erroInfo) {
					Modular.log(oError, errMsg, erroInfo);
				});
			} else if (sConfigPath) {
				promise = Promise.reject("Modular is not finished loading.");
			} else {
				promise = Promise.reject("Invalid configuration path");
			}
			return promise;
		},
		/**
		 * [prepareJq description]
		 * @return {[type]}              [description]
		 */
		prepareJq: function() {
			if (oWindow. jQuery) {
				ojQuery = oWindow. jQuery;
			} else {
				ojQuery = liteJq();
			}
			return Promise.resolve(ojQuery);
		},
		getModuleConfig : function (moduleName) {
			var sConfig, self = this;
			for (sConfig in self.loadedModules) {
				if (self.loadedModules.hasOwnProperty(sConfig)
					&&  self.loadedModules[sConfig].$options.name === moduleName) {
						return self.loadedModules[sConfig].$options;
				}
			}
		}
	};

	/**
	 * [Config description]
	 * @param {[type]} options [description]
	 * @param {[type]} modular [description]
	 */
	function Config(options, modular) {
		this.$modular = modular;
		
		options.modulesLocation = options.modulesLocation ||
			DEFAULT_MODULE_LOCATION;
		options.modulesConfigName = options.modulesConfigName ||
			DEFAULT_MODULE_CONFIG;
		options.templateSelector = options.templateSelector ||
			DEFAULT_TEMPLATE_SELECTOR;
		this.$options = options;
		
		this.$docFragment = oDoc.createDocumentFragment();
		this.$headTemplate = oDoc.createElement('div');
		this.$docFragment.appendChild(this.$headTemplate);
		
		this.$notifCallbacks = [];
	}
	/**
	 * [prtotype description]
	 * @type {Object}
	 */
	Config.prototype = {
		load: function() {
			var self = this, 
				templates = {};
			this.$options.cachedTempates = [];
			//record loaded templates 
			self.notify(function(info) {
				if (typeof info === 'object') {
					templates[info.id] = info && info.dom;
					//in-case url is used 
					if (info.url !== info.id) {
 						templates[info.url] = info.id;					
					}
				}
			}, /\.html$/);

			self.$modular.ready(function() {
				self.bindTemplates(templates);
				templates = null;
			});

			if (self.$options.main) {
				self.$options.dependencies = self.$options.dependencies || [];
				self.$options.dependencies.push(self.$options.main);
			}
			
			return self.loadDependencies()
				.then(function() {
					return Promise.all([
						self.loadScripts().then(function() {
							self.notify(self.$options.configRoot + self.$options.configName);
						}),
						self.loadTemplates(),
						self.loadStyles(),
						self.loadSubModules()
					]);
				}).then(function() {
					//cleanup callbacks
					self.notify(false);
					return self;
				});
		},
		notify: function(notify, expression) {
			var self = this,
				nNotif, notifInfo, callback, extension;
			if (typeof notify === "function") {
				expression = (!expression || expression instanceof RegExp) ?
					expression : (new RegExp(expression + ''));				
				self.$notifCallbacks.push({
					"expr": expression,
					"callback": notify
				});				
			} else if (typeof notify === "number") {
				for (nNotif = 0; nNotif < self.$notifCallbacks.length; nNotif++) {
					notifInfo = self.$notifCallbacks[nNotif];
					extension = expression;
					expression = notifInfo.expr;
					if (!expression || (expression && (expression.test(extension) ))) {
						callback = notifInfo.callback;
						callback(notify, extension);
					}
				}
			} else if (notify) {
				for (nNotif = 0; nNotif < self.$notifCallbacks.length; nNotif++) {
					notifInfo = self.$notifCallbacks[nNotif];
					expression = notifInfo.expr;
					if (!expression || (expression && (expression.test(notify) || expression.test(notify.url)))) {
						callback = notifInfo.callback;
						callback(notify);
					}
				}
			} else if (notify === false) {
				while (self.$notifCallbacks && self.$notifCallbacks.length > 0) {
					notifInfo = self.$notifCallbacks.pop();
					callback = notifInfo.callback;
					callback(false);
				}
			}
		},
		bindTemplates: function(domTemplates) {
			var self = this,
				bindings = self.$options.bindings,
				templateId, selector, targetDom, templateDom;
			self.$bindingStack = [];
			for (templateId in bindings || {}) {
				selector = bindings[templateId];
				templateDom = domTemplates[templateId];
				targetDom = selector && oDoc.querySelector(selector);
				if (targetDom && templateDom) {
					self.$bindingStack.push(templateId);
					self.appendTemplates(targetDom, templateDom, domTemplates);
					self.$bindingStack.pop();
				}
			}

			for (templateId in domTemplates || {}) {
				templateDom = domTemplates[templateId];
				if (templateDom instanceof Element && !templateDom.bounded) {
					self.$bindingStack.push(templateId);
					self.injectTemplates(templateDom, domTemplates);
					self.$bindingStack.pop();
					this.$options.cachedTempates.push(templateDom);
				}
			}
		},
		appendTemplates: function(targetDom, templateParentDom, domTemplates) {
			var self = this,
				cloneTemplate, nextChild, docFragment;
			templateParentDom.bounded = true;
			if (targetDom && templateParentDom && templateParentDom.firstChild) {
				nextChild = templateParentDom.firstChild;
				docFragment = oDoc.createDocumentFragment();
				while(nextChild) {
					cloneTemplate = nextChild.cloneNode(true);
					if (cloneTemplate.nodeType === Node.ELEMENT_NODE) {
						self.injectTemplates(cloneTemplate, domTemplates);
					}
					docFragment.appendChild(cloneTemplate);
					nextChild = nextChild.nextSibling;
				}
				targetDom.appendChild(docFragment);
						
			}

		},
		injectTemplates: function(targetParentDom, domTemplates) {
			var self = this,
				ATTR_EXP = /\[([^\]]+)\]/,
				templateId, selector, targetDoms, targetDom,
				cloneTemplate, nDom, selMatch, attribute, isDataAttribute, isBindingRecursive;
			
			selector = self.$options.templateSelector;
			selMatch = selector.match(ATTR_EXP);
			attribute = selMatch && selMatch[1];
			
			targetDoms = (selector && targetParentDom.querySelectorAll(selector)) || [];	
			targetDoms = Array.prototype.slice.call(targetDoms);
			if (targetParentDom.matches(selector)) {
				targetDoms.push(targetParentDom);
			}
			for (nDom = 0; attribute && nDom < targetDoms.length; nDom++) {
				targetDom = targetDoms[nDom];
				templateId = targetDom.getAttribute(attribute);
				
				templateDom = domTemplates[templateId];
				if (typeof templateDom === "string") {
					//mapping url with it's ID
					templateId = templateDom;
					templateDom = domTemplates[templateId];
				} else if (!templateDom && domTemplates[self.$options.configRoot + templateId]) {
					templateDom = domTemplates[self.$options.configRoot + templateId];
				}
				isBindingRecursive = (self.$bindingStack.indexOf(templateId) >= 0);
				if (targetDom && templateDom && !isBindingRecursive) {
					self.$bindingStack.push(templateId);
					self.appendTemplates(targetDom, templateDom, domTemplates);
					self.$bindingStack.pop();
				} else if (isBindingRecursive) {
					Modular.log("Recursive binding: (", 
						self.$bindingStack.concat([templateId]).join(' => '),
						"). skiping...");
				}
			}		
		},
		loadDependencies: function() {
			var self = this;
			return asyncLoadScripts(
				self.$options.dependencies || [],
				self.$options.configRoot,
				undefined,
				function(scriptInfo, expression) {
					self.notify(scriptInfo, expression);
				}
			);
		},
		loadScripts: function() {
			var self = this;
			return syncLoadScripts(
				self.$options.scripts || [],
				self.$options.configRoot,
				undefined,//afterElem
				function(scriptInfo, expression) {
					self.notify(scriptInfo, expression);
				}
			);
		},
		loadStyles: function() {
			var self = this;
			return syncLoadScripts(
				self.$options.styles || [],
				self.$options.configRoot,
				undefined,//afterElem
				function(scriptInfo, expression) {
					self.notify(scriptInfo, expression);
				}
			);
		},
		loadTemplates: function() {
			var self = this;
			return syncLoadScripts(
				self.$options.templates || [],
				self.$options.configRoot,
				self.$headTemplate,
				function(scriptInfo, expression) {
					self.notify(scriptInfo, expression);
				}
			);
		},
		loadSubModules: function() {
			var self = this,
				subModules = self.$options.modules || [],
				baseUrl = (self.$options.configRoot || '') + self.$options.modulesLocation,
				modConfigName = this.$options.modulesConfigName,
				promAll = [],
				promMod;
			for (var nMod = 0; nMod < subModules.length; nMod++) {
				promMod = self.$modular.loadModuleFromConfig(
					baseUrl + subModules[nMod] + '/' + modConfigName
				);
				promAll.push(promMod);
				promMod.then(function(subConfig) {
					subConfig.parent = self;
				});
			}
			return Promise.all(promAll);
		}
	};
	
	function liteJq() {
		return {
			get : function () {
			},
			holdReady : function () {

			},
			getJSON : function () {				
			}
		};
	}

	var modules= {}, modular = new Modular(),
		nElem, promAll = [], currentScript,
		modSrcElems = oDoc.querySelectorAll(MODULAR_SELECTOR);
	for (nElem = modSrcElems.length - 1; nElem >= 0; nElem--) {
		promAll.push(modular.loadModElem(modSrcElems[nElem]));
	}
	Promise.all(promAll).catch(function (oError) {
		modular.notify(oError);
		Modular.log("Loading failed:", oError);
	});
	oWindow.modular = modular;
	function isValidExport(exports) {
		var valid = typeof exports !== 'undefined';
		valid = valid && ((exports instanceof Array) 
			|| (['number', 'function', 'bool', 'object'].indexOf(typeof exports) >= 0));
		return valid;
	}
	function registerModule(path, exports) {
		if (path && oWindow.module && oWindow.module.exports 
			&& isValidExport(oWindow.module.exports)) {
				modules[path] = oWindow.module.exports;
		}
		delete oWindow.exports;
		delete oWindow.module;
		oWindow.module = {
			exports : exports || {}
		};
		oWindow.exports = oWindow.module.exports;
	}	
	function modularjs(deps, callback, exports) {		
		//clean up module.exports
		registerModule(undefined, exports);

		currentScript = modular.defer();
		currentScript.promise.then(function(currentPath) {
			currentScript = undefined;
			var dirname, fname, fmatch = currentPath.match(FILE_NAME_EXP), allPromises = [];
			fname = fmatch && fmatch[0] || '';
			dirname = currentPath.substr(0, currentPath.length - fname.length);
			registerModule(currentPath);
			(deps || []).forEach(function(dep) {
				var path = dirname + dep;
				if (modules[path]) {
					allPromises.push(Promise.resolve(modules[path]));
				} else if (null !== path.match(/\.js$/)) {
					allPromises.push(loadScript(path)
						.then(function (depPath) {
							return modules[depPath];
						}));
				}			
			});
			Promise.all(allPromises).then(function (injections) {
				if (typeof callback === 'function') {
					callback.apply(this, injections);					
				}
			});
		});
		setTimeout(function () {
			if (currentScript) {
				currentScript.reject('modularjs should be called on top level');
			}
		});
		return currentScript.promise;
	}
	function extend(dest, source) {
		var key;
		if (source && dest) {
			for (key in source) {
				if (source.hasOwnProperty(key)) {
					dest[key] = source[key];
				}
			}
		}
		return dest;
	}
	function defineModule(deps, callback) {
		var scriptPath, exports;
		if ((deps instanceof Array) && (typeof callback === 'function')) {
			modularjs(deps, function () {
				exports = callback.apply(this, arguments);
				if (scriptPath && modules[scriptPath]) {
					if(typeof exports !== 'object') {
						modules[scriptPath] = exports;
					} else {
						modules[scriptPath] = extend(modules[scriptPath] || {}, exports)
					}
				}				
			}).then(function (currentPath) {
				scriptPath = currentPath;
			});
		} else if (typeof deps !== 'undefined') {			
			modularjs(undefined, undefined, deps);
		}
	}
	oWindow.modularjs = modularjs;
	oWindow.define = defineModule;
	return modular;

	//*** HELPER FUNCTIONS ***//	
	/**
	 * [asyncLoadScripts description]
	 * @param  {[type]} urlFiles     [description]
	 * @param  {[type]} baseUrl      [description]
	 * @param  {[type]} afterElement [description]
	 * @return {[type]}              [description]
	 */
	function asyncLoadScripts(urlFiles, baseUrl, afterElement, notifCallback) {
		var urls = urlFiles || [],
			promAll = [],
			extensionCounter = {},
			promPrev = Promise.resolve(), 
			filename, nUrl, extension, match;
		for (nUrl = 0; nUrl < urls.length; nUrl++) {
			filename = urls[nUrl];
			match = filename.match(/(\.[A-Za-z]+)(:|$)/);
			extension = (match && match[1]) || '';			
			promPrev = promPrev.then((function (fullpath, fileExt) {
				return function (){
					var promLoad = null;
					if (fileExt.toLowerCase() === '.js') {
						promLoad = (loadScript(fullpath, afterElement));
					} else if (fileExt.toLowerCase() === '.css') {
						promLoad = (loadStyle(fullpath, afterElement));
					} else if (fileExt.toLowerCase() === '.html') {
						promLoad = (loadTemplate(fullpath, afterElement));
					} else {
						Modular.log('Unsupported Extension at ', fullpath);
					}
					if (promLoad) {
						notifCallback && promLoad.then(notifCallback);
					}
					return promLoad;
				};
			})((baseUrl || '') + filename, extension));
			extensionCounter[extension]  = extensionCounter[extension]  
					&& (extensionCounter[extension]  + 1) || 1;			
		}
		if (notifCallback) {
			for (extension in extensionCounter) {
			 	notifCallback(extensionCounter[extension], extension);
			}
		}
		return promPrev;
	}
	/**
	 * [syncLoadScripts description]
	 * @param  {[type]} urlFiles     [description]
	 * @param  {[type]} baseUrl      [description]
	 * @param  {[type]} afterElement [description]
	 * @return {[type]}              [description]
	 */
	function syncLoadScripts(urlFiles, baseUrl, afterElement, notifCallback) {
		var urls = urlFiles || [],
			promAll = [],
			extensionCounter = {},
			promLoad, filename, nUrl, extension, match;
		for (nUrl = 0; nUrl < urls.length; nUrl++) {
			filename = urls[nUrl];
			match = filename.match(/(\.[A-Za-z]+)(:|$)/);
			extension = (match && match[1]) || '';
			if (extension.toLowerCase() === '.js') {
				promLoad = (loadScript((baseUrl || '') + filename, afterElement));
			} else if (extension.toLowerCase() === '.css') {
				promLoad = (loadStyle((baseUrl || '') + filename, afterElement));
			} else if (extension.toLowerCase() === '.html') {
				promLoad = (loadTemplate((baseUrl || '') + filename, afterElement));
			} else {
				promLoad = null;
				Modular.log('Unsupported Extension at ', filename);
			}
			if (promLoad) {
				extensionCounter[extension]  = extensionCounter[extension]  
					&& (extensionCounter[extension]  + 1) || 1;
				promAll.push(promLoad);
				notifCallback && promLoad.then(notifCallback);
			}
		}
		if (notifCallback) {
			for (extension in extensionCounter) {
			 	notifCallback(extensionCounter[extension], extension);
			}
		}
		return Promise.all(promAll);
	}

	/**
	 * [loadScript description]
	 * @param  {[type]} scriptUrl    [description]
	 * @param  {[type]} afterElement [description]
	 * @return {[type]}              [description]
	 */
	function loadScript(scriptUrl, afterElement) {
		var headElem, scriptElem = document.createElement('script');
		scriptElem.setAttribute('type', 'text/javascript');
		scriptElem.setAttribute("src", scriptUrl);
		
		if (afterElement && afterElement.parentNode) {
			afterElement.parentNode.insertBefore(scriptElem, afterElement.nextSibling);
		} else {
			headElem = oDoc.getElementsByTagName('head').item(0);
			headElem.appendChild(scriptElem);
		}
		return (new Promise(function(resolve, reject) {
			scriptElem.onload = function() {
				if (currentScript && currentScript.resolve) {
					currentScript.resolve(scriptElem.src);
				}
				resolve(scriptElem.src);
			};
			scriptElem.onerror = reject;
		}));
	}
	/**
	 * [loadStyle description]
	 * @param  {[type]} styleUrl     [description]
	 * @param  {[type]} afterElement [description]
	 * @return {[type]}              [description]
	 */
	function loadStyle(styleUrl, afterElement) {
		var headElem,
			styleElem = document.createElement('link');
		styleElem.setAttribute('type', 'text/css');
		styleElem.setAttribute('rel', 'stylesheet');

		styleElem.setAttribute("href", styleUrl);
		if (afterElement && afterElement.parentNode) {
			afterElement.parentNode.insertBefore(styleElem, afterElement.nextSibling);
		} else {
			headElem = oDoc.getElementsByTagName('head').item(0);
			headElem.appendChild(styleElem);
		}
		return (new Promise(function(resolve, reject) {
			styleElem.onload = function() {
				resolve(styleElem.href);
			};
			styleElem.onerror = reject;
		}));
	}
	/**
	 * [loadTemplate description]
	 * @param  {[type]} templateUrl  [description]
	 * 			templateUrl Format => (htmlUrl:templateId)|htmlUrl
	 * @param  {[type]} afterElement [description]
	 * @return {[type]}              [description]
	 */
	function loadTemplate(templateUrl, afterElement) {
		var headElem,
			templateElem = document.createElement('div'),

			templateParts = templateUrl.split(':'),
			htmlUrl = templateParts[0],
			templateId = templateParts[1] || htmlUrl;

		templateElem.setAttribute("href", htmlUrl);
		templateElem.setAttribute("id", 'template_' + templateId);
		if (afterElement) {
			afterElement.parentNode.insertBefore(templateElem, afterElement.nextSibling);
		} else {
			return Promise.reject('Cannot load template with out afterElement parameter.');
		}
		return (new Promise(function(resolve, reject) {
			ojQuery.get(htmlUrl, function(response, status, xhr) {
				if (status !== 'error') {
					templateElem.innerHTML = response;
					resolve({
						url: htmlUrl,
						id: templateId,
						dom: templateElem
					});
				} else {
					reject(xhr.statusText);
				}
			});
		}));
	}
}(this));
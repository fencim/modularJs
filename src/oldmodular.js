/**
 *
 */
(function (oWindow) {
    var DEFAULT_MODULE_CONFIG = "modular.json",
        DEFAULT_MODULE_LOCATION = "modules/",
        MODULAR_SELECTOR = "[data-modular], [modular]",

        oDoc = oWindow.document,
        ojQuery = oWindow.$;

    Modular.INIT = 0,
    Modular.LOADING = 1,
    Modular.LOADED = 2,
    Modular.FINISHED = 2,
    Modular.FAILED = -1;

    Modular.log = function () {
        console.log.apply(console, arguments)
    };

    /**
     * [Modular description]
     */
    function Modular() {
        this.onReadyCallbacks = [];
        this.state = Modular.INIT;
        this.srcRoot = undefined;
        this.libSrcName = undefined;
        this.loadedModules = {};
    }
    /**
     * [prototype description]
     * @type {Object}
     */
    Modular.prototype = {
        ready: (function () {
            var callbacks = [];
            return function (fCallback) {
                var self = this;
                if ((fCallback === undefined) && (self.state === Modular.FINISHED)) {
                    Modular.log('ready:');
                    ojQuery.holdReady(false);
                    while (callbacks && callbacks.length > 0) {
                        fCallback = callbacks.pop();
                        fCallback(self);
                    }
                } else if (typeof fCallback === 'function') {
                    if ([Modular.LOADED, Modular.LOADING, Modular.INIT].indexOf(self.state) >= 0) {
                        callbacks.push(fCallback);
                    } else if (self.state === Modular.FINISHED) {
                        fCallback(self);
                    }
                }
            };
        }()),

        /**
         * [loadModElem description]
         * @param  {[type]} scriptElem [description]
         * @return {[type]}            [description]
         */
        loadModElem: function (scriptElem) {
            var self = this,
                moduleConfig = (scriptElem.dataset && scriptElem.dataset.modular) || scriptElem.getAttribute("modular") || DEFAULT_MODULE_CONFIG,
                promLoader,
                FILEANAME_EXP = /[^/]+$/;
            self.libSrcName = this.libSrcName || scriptElem.src.match(FILEANAME_EXP)[0];
            self.srcRoot = self.srcRoot || scriptElem.src.substr(0, scriptElem.src.length - self.libSrcName.length);
            if (self.state === Modular.INIT) {
                promLoader = self.loadModularDependecies(scriptElem).then(function () {
                    self.state = Modular.LOADED;
                    return self.loadModuleFromConfig(moduleConfig);
                }, function (oError) {
                    self.state = Modular.FAILED;
                });
                self.state = Modular.LOADING;
            } else if (self.state === Modular.LOADED) {
                promLoader = self.loadModuleFromConfig(moduleConfig);
            }
            return promLoader.then(function () {
                self.state = Modular.FINISHED;
                self.ready();
                return self;
            });
        },
        /**
         * [loadModuleFromConfig description]
         * @param  {[type]} sConfigPath [description]
         * @return {[type]}               [description]
         */
        loadModuleFromConfig: function (sConfigPath) {
            var self = this,
                promise,
                FILEANAME_EXP = /[^/]+$/;
            if ((self.state === Modular.LOADED) && !self.loadedModules[sConfigPath]) {
                promise = ojQuery.getJSON(sConfigPath).then(function (oConfig) {
                    var config;
                    oConfig.configName = oConfig.configName || sConfigPath.match(FILEANAME_EXP)[0];
                    oConfig.configRoot = oConfig.configRoot || sConfigPath.substr(0, sConfigPath.length - oConfig.configName.length);

                    config = new Config(oConfig, self);
                    self.loadedModules[sConfigPath] = config;
                    return config.load();
                }, function (oError) {
                    Modular.log(oError);
                });
            } else {
                promise = Promise.reject("Modular is not finished loading.");
            }
            return promise;
        },
        /**
         * [loadModularDependecies description]
         * @param  {[type]} afterElement [description]
         * @return {[type]}              [description]
         */
        loadModularDependecies: function (afterElement) {
            var dependencies = [],
                promises = [],
                promAll;
            if (!ojQuery) {
                dependencies.push("lib/jquery/jquery-2.0.0.min.js");
            }
            promAll = asyncLoadScripts(dependencies, this.srcRoot, afterElement);
            if (!ojQuery) {
                promAll.then(function () {
                    ojQuery = oWindow.$;
                    ojQuery.holdReady(true);
                });
            } else {
                ojQuery.holdReady(true);
            }
            return promAll;
        }
    };

    /**
     * [Config description]
     * @param {[type]} options [description]
     * @param {[type]} modular [description]
     */
    function Config(options, modular) {
        this.options = options;
        this.module = modular;
        this.options.modulesLocation = this.options.modulesLocation || DEFAULT_MODULE_LOCATION;
        this.options.modulesConfigName = this.options.modulesConfigName || DEFAULT_MODULE_CONFIG;
        this.docFragment = oDoc.createDocumentFragment();
        this.headTemplate = oDoc.createElement('div');
        this.docFragment.appendChild(this.headTemplate);
    }
    /**
     * [prtotype description]
     * @type {Object}
     */
    Config.prototype = {
        load: function () {
            var self = this;
            self.module.ready(function () {
                self.bindTemplates();
            });
            return self.loadDependencies()
                .then(function () {
                    return self.loadScripts();
                })
                .then(function () {
                    return self.loadStyles();
                })
                .then(function () {
                    return self.loadTemplates();
                })
                .then(function () {
                    return self.loadSubModules();
                })
                .then(function () {
                    return self;
                });
        },
        bindTemplates: function () {
            var self = this,
                bindings = self.options.bindings,
                templateId, selector, templateDom, href,
                targetDoms, nDom, nTemplate, template, exp, matchExp,
                targetDom, attributeSelector, attrSelectors = [];
            for (templateId in bindings || {}) {
                selector = bindings[templateId];
                targetDoms = [];
                [].push.apply(targetDoms, ojQuery(selector));
                exp = templateId.match(/regexp=(.*)/);
                attributeSelector = selector && selector.match(/\[(.*)\]/);
                attributeSelector = attributeSelector && attributeSelector[1];
                if (exp && attributeSelector) {
                	attrSelectors.push(attributeSelector);
                    exp = exp && (new RegExp(exp[1]));
                    for (nDom = 0; exp && nDom < targetDoms.length; nDom++) {
                        for (var nTemplate = 0; nTemplate < self.docFragment.children.length; nTemplate++) {
                            template = self.docFragment.children[nTemplate];
                            targetDom = targetDoms[nDom];
                            href = template.href || template.getAttribute('href');
                            matchExp = href && href.match(exp);
                            matchExp = matchExp && (matchExp[1] || matchExp[0])
                            if (matchExp && (matchExp === targetDom.getAttribute(attributeSelector))) {
                                targetDom.appendChild(template.cloneNode(true));
                                targetDoms.splice(targetDoms.indexOf(targetDom), 1);
                                [].push.apply(targetDoms, ojQuery(selector, targetDom));
                            }
                        }
                    }
                } else {
                    templateDom = self.docFragment.querySelector("[id=template_" + templateId + "]");
                    if (targetDoms && (targetDoms.length === 1) && templateDom) {
                    	targetDom = targetDoms[0];
                        targetDom.appendChild(templateDom.cloneNode(true));
                        targetDoms.splice(0, 1);
                        [].push.apply(targetDoms, ojQuery(selector, targetDom));
                    }
                }
            }
            // if (targetDoms.length > 0) {
            // 	var templates = [], attrs;            	
	           //  for (nDom = 0; exp && nDom < targetDoms.length; nDom++) {
	           //  	targetDom = targetDoms[nDom];	            	
            //         href = template.href || template.getAttribute('href');
            //         templates.push(href);
	           //  }
	           //  asyncLoadScripts(
	           //  	templates,
	           //  	self.options.configRoot,
            //     	self.headTemplate
	           //  ).then(function () {
	           //  	for (nDom = 0; exp && nDom < targetDoms.length; nDom++) {
		          //   	targetDom = targetDoms[nDom];
	           //          href = template.href || template.getAttribute('href');	
	           //          templateDom = self.docFragment.querySelector("[href=" + href + "]");                    
		          //   }
	           //  });
            // }
        },
        loadDependencies: function () {
            return asyncLoadScripts(
                this.options.dependencies || [],
                this.options.configRoot
            );
        },
        loadScripts: function () {
            return syncLoadScripts(
                this.options.scripts || [],
                this.options.configRoot
            );
        },
        loadStyles: function () {
            return syncLoadScripts(
                this.options.styles || [],
                this.options.configRoot
            );
        },
        loadTemplates: function () {
            return syncLoadScripts(
                this.options.templates || [],
                this.options.configRoot,
                this.headTemplate
            );
        },
        loadSubModules: function () {
            var self = this,
                subModules = self.options.modules || [],
                baseUrl = (self.options.configRoot || '') + self.options.modulesLocation,
                modConfigName = this.options.modulesConfigName,
                promAll = [];
            for (var nMod = 0; nMod < subModules.length; nMod++) {
                promAll.push(
                    self.module.loadModuleFromConfig(
                        baseUrl + subModules[nMod] + '/' + modConfigName
                    )
                );
            }
            return Promise.all(promAll);
        }
    };

    var modular = new Modular(),
        nElem,
        modSrcElems = oDoc.querySelectorAll(MODULAR_SELECTOR);
    for (nElem = modSrcElems.length - 1; nElem >= 0; nElem--) {
        modular.loadModElem(modSrcElems[nElem]);
    }

    oWindow.modular = modular;
    return modular;

    //*** HELPER FUNCTIONS ***//	
    /**
     * [asyncLoadScripts description]
     * @param  {[type]} urlFiles     [description]
     * @param  {[type]} baseUrl      [description]
     * @param  {[type]} afterElement [description]
     * @return {[type]}              [description]
     */
    function asyncLoadScripts(urlFiles, baseUrl, afterElement) {
        return new Promise(function (resolve) {
            var nIndex = 0;

            function loadNext() {
                if (nIndex == urlFiles.length) {
                    resolve();
                } else {
                    loadScript((baseUrl || '') + urlFiles[nIndex], afterElement)
                        .then(loadNext, loadNext);
                }
                nIndex++;
            }
            loadNext();
        });
    }
    /**
     * [syncLoadScripts description]
     * @param  {[type]} urlFiles     [description]
     * @param  {[type]} baseUrl      [description]
     * @param  {[type]} afterElement [description]
     * @return {[type]}              [description]
     */
    function syncLoadScripts(urlFiles, baseUrl, afterElement) {
        var urls = urlFiles || [],
            promAll = [],
            filename,
            nUrl,
            extension,
            match;
        for (nUrl = 0; nUrl < urls.length; nUrl++) {
            filename = urls[nUrl];
            match = filename.match(/\.([A-Za-z\:0-9]+)$/);
            extension = (match && match[1]) || '';
            if (extension.toLowerCase() === 'js') {
                promAll.push(loadScript((baseUrl || '') + filename, afterElement));
            } else if (extension.toLowerCase() === 'css') {
                promAll.push(loadStyle((baseUrl || '') + filename, afterElement));
            } else if (extension.substr(0, 4).toLowerCase() === 'html') {
                promAll.push(loadTemplate((baseUrl || '') + filename, afterElement));
            } else {
                Modular.log('Unsupported Extension at ', filename);
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
        if (afterElement) {
            afterElement.parentNode.insertBefore(scriptElem, afterElement.nextSibling);
        } else {
            headElem = oDoc.getElementsByTagName('head').item(0);
            headElem.appendChild(scriptElem);
        }
        return (new Promise(function (resolve, reject) {
            scriptElem.onload = function () {
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
        if (afterElement) {
            afterElement.parentNode.insertBefore(styleElem, afterElement.nextSibling);
        } else {
            headElem = oDoc.getElementsByTagName('head').item(0);
            headElem.appendChild(styleElem);
        }
        return (new Promise(function (resolve, reject) {
            styleElem.onload = function () {
                resolve(styleElem.src);
            };
            styleElem.onerror = reject;
        }));
    }
    /**
     * [loadTemplate description]
     * @param  {[type]} templateUrl  [description]
     * @param  {[type]} afterElement [description]
     * @return {[type]}              [description]
     */
    function loadTemplate(templateUrl, afterElement) {
        var headElem,
            templateElem = document.createElement('div'),
            //Parts Format => htmlUrl:templateId
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
        return (new Promise(function (resolve, reject) {
            ojQuery.get(htmlUrl, function (response, status, xhr) {
                if (status !== 'error') {
                    templateElem.innerHTML = response;
                    resolve({
                        url: htmlUrl,
                        id: templateId
                    });
                } else {
                    reject(xhr.statusText);
                }
            });
        }));
    }
}(this));
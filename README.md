# modularJs
Inspired from the ideas of requirejs, nodejs, angularjs, and bower.
__modularJs__ was created for large web apps that needs to be modularized.

It adapts modular configuration structure of __nodejs__ and/or __bower__;
and establishes connection between modules using dependency injection similar to __requirejs__;
and handles loading of modules dynamically based from module configuration and dependency injections;
and support loading/caching for js, css, and html templates similar to angularjs;
with full compatibility integration with __angularjs, bower__ and other web app frameworks/utilities like ui __bootstrap__.

__modularjs__ is still in its early development stage with no official released version yet.

# Getting Started
## Installation
Download:
```
bower install modular-js --save
```
Page Root Script:
```html
<script type="text/javascript" src="bower_components/modular-js/src/modularjs.js" data-modular="modular.json" ></script>
```
Configuration:
```json
{
	"name" : "demo"
}
```
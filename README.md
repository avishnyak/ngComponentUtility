[![Build Status](https://travis-ci.org/ipatalas/ngComponentUtility.svg?branch=master)](https://travis-ci.org/ipatalas/ngComponentUtility)
[![bitHound Dependencies](https://www.bithound.io/github/ipatalas/ngComponentUtility/badges/dependencies.svg)](https://www.bithound.io/github/ipatalas/ngComponentUtility/master/dependencies/npm)
[![bitHound Code](https://www.bithound.io/github/ipatalas/ngComponentUtility/badges/code.svg)](https://www.bithound.io/github/ipatalas/ngComponentUtility)
[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/d/ipatalas.vscode-angular-components-intellisense.svg)](https://marketplace.visualstudio.com/items?itemName=ipatalas.vscode-angular-components-intellisense)

# Table of contents

- [Synopsis](#synopsis)
- [Features](#features)
	- [Intellisense](#intellisense)
		- [Controller model in views (**introduced in 0.4.0**)](#controller-model-in-views)
	- [Go To Definition](#go-to-definition)
		- [Controllers](#controllers)
		- [Templates](#templates)
	- [Find All References (**introduced in 0.5.0**)](#find-all-references)
	- [Find unused components (**introduced in 0.5.0**)](#find-unused-components-experimental)
	- [Component member diagnostics (**introduced in 0.8.0**)](#component-member-diagnostics)
	    - [Code actions (**introduced in 0.9.0**)](#code-actions)
	- [Watch file changes (**introduced in 0.6.0**)](#watch-file-changes)
- [Configuration](#configuration)
- [Commands](#commands)
- [Performance note on configuration globs](#performance-note-on-configuration-globs)
- [Changelog](#changelog)

# Synopsis

This extension is a result of hackathon event done in the company we work for. We had an opportunity to invest 2 days into anything we could possibly want.
We chose to develop an extension for VS Code which would make our daily work easier. Our current project is an Angular 1.5 based web application. As Angular developers we wanted to have auto-completion for all custom components that are available in our application.

# Features

## Intellisense

Given the following components in a project:
```TypeScript
angular.module('app').component('exampleComponent', {
	/* other settings */
	bindings: {
		config: '<',
		data: '<'
	}
});

angular.module('app').component('otherComponent', {
	/* other settings */
	bindings: {
		config: '<',
		data: '<'
	}
});
```

One should be able to use auto-completion like that:

![Auto-completion popup](images/component.gif)

As a result component's html code along with all bindings is added.

It can also help with the bindings themselves (will only suggest missing ones):

![Auto-completion popup](images/bindings.png)

There is also a command to refresh components cache which might be useful if you're developing components constantly and don't want to restart vscode each time.
You can trigger the command from command panel, it's called `Refresh components cache`. Alternatively you can just click the button on the status bar:

![Status bar button](images/statusbar.png)

### Controller model in views

You can use auto-completetion for controller members while being in component's view like seen on the screenshot below:

![Model intellisense](images/model-intellisense.png)

Currently only one level of intellisense is available since otherwise the extension would have to scan all files in the whole project. Controller files are already scanned so it was little effort to suggest first-level members.

> **New in 0.8.0:** Members from all base classes will also be suggested (see [Controllers](#controllers))

> **New in 0.6.0:** `Go To Definition` also works for model members

## Go To definition

You can go from html directly to either the component definition, controller or template. Just use F12 (default) or `Go To Definition` command (either from context menu or commands panel) when cursor is focused on a component in html view.
Depending on the configuration in `ngComponents.goToDefinition` specific files will show up in Go To Definition window (see screenshot below).
If there is only one file configured, let's say the template, it will go straight to this file.

### Controllers

Controllers are searched using `ngComponents.controllerGlobs` setting. They are matched against the name used in component options `controller` field.
This can be either an identifier of the class used directly or string literal specifying the name of the controller registration in Angular which basically means one can name the Angular controller differently than the class itself and this feature will still work.

For base classes (scanning their members) to work those base class files have to fit into the same glob. One has to extend it to cover those files if naming convention is different. For instance I use this:
`app/**/*{Controller,ControllerBase}.ts`

### Templates

Templates are searched based on either the `templateUrl` component option field or `template` field in the same component. They are mutually exclusive and both work here. Currently supported variations are:

- `templateUrl: 'components/exampleComponent.html'`
- `template: '<div>inline html template</div>'`
- `template: require('./components/exampleComponent.html')`

In case you have different scenarios please let me know the details and I'll try to include it in next version.

![Go To Definition](images/gotodefinition.gif)

## Find All References

You can use `Find All References` feature of vscode to navigate through usages of particular components. It works in all component parts: html template, controller and component itself.

In HTML template cursor has to be focused on component name, not the binding or the inner html of the component for this to work:

![Find unused components](images/find-all-references-1.png)

In component definition file cursor has to be on component name:

![Find unused components](images/find-all-references-2.png)

In controller file cursor has to be on the class name:

![Find unused components](images/find-all-references-3.png)

**New in 0.7.0**

Find all references now works also for controller members, ie. they will be found in components' templates as well:

![Find unused components](images/find-all-references-4.png)

## Find unused components

This feature will allow you to easily find components which are not used in the project. Selecting one of the unused components will navigate to it in the editor.

It does understand HTML a bit so commented out parts will be taken into account. See screenshot below:

![Find unused components](images/find-unused.png)

## Component member diagnostics

Experimental feature to detect using non-existing fields in component template:

![Member diagnostics](images/member-diagnostics.png)

This will check controller members including base classes if possible as well as component bindings.
This feature is off by default until getting stable enough. Use `ngComponents.memberDiagnostics.enabled` to enable it.

### Code actions

Member diagnostics has been enhanced with Code Actions now:

![Code actions](images/code-actions.png)

Like seen on the image you can ignore an error for instance if it's a false positive (which may happen rarely) or for any other reasons. It will be added to a separate configuration file which resides in .vscode directory under the workspace. One can commit that file to repository so that whole team sees the same.

Other option is a 'Did you mean' suggestion. It uses great __didyoumean2__ library under the hood and exposes one of its [options](https://github.com/foray1010/didyoumean2#threshold-integernumber) via `ngComponents.memberDiagnostics.didYouMean.similarityThreshold` setting. Obviously after selecting this fix the text will get replaced by the suggestion.

## Watch file changes

To avoid a need to manually refresh components cache every time a change is introduced a new mechanism of file watching has been introduced. It watches all parts of the component - ie. component itself, template and controller.
Whenever one of the file is changed it should automatically rebuild the cache so that all features relying on that file should immediately reflect the changes. It will work for intellisense, `Find All References`, `Go To Definition` and the others.

It is not perfect yet and may not always work as desired. One known issue is when a project changes the branch. It sometimes loses the changes and for that case it's still better to call `Refresh Components Cache` command. For normal development it should work just fine.

# Configuration

This plugin contributes the following [settings](https://code.visualstudio.com/docs/customization/userandworkspace):

- `ngComponents.componentGlobs`: array of glob strings used to search for components. Default value is  **[\*\*/\*Component.ts]**
- `ngComponents.controllerGlobs`: array of glob strings used to search for controllers (used by `Go To Definition`). Default value is  **[\*\*/\*Component.ts]**
- `ngComponents.htmlGlobs`: array of glob strings used to search for html views (used by `Find All References`). Default value is  **[\*\*/\*Component.ts]**
- `ngComponents.routeGlobs`: array of glob strings used to search for angular-ui-router files (used by `Find All References`). Default value is  **[\*\*/\*route.ts]**
- `ngComponents.goToDefinition`: array of strings to define which files `Go To Definition` for a component should show. Allowed values are *template*, *controller*, *component*. Default value is **["template", "controller"]**
- `ngComponents.debugConsole`: boolean value to show debug information. Default value is **false**
- `ngComponents.controller.publicMembersOnly`: whether to suggest all members in view model auto complete. Default value is **true**
- `ngComponents.controller.excludedMembers`: a regular expression excluding member from view model auto completion. Default value is **^\\$** (for Angular lifecycle methods)
- `ngComponents.logging.verbose`: enable verbose logging (for troubleshooting)
- `ngComponents.logging.redirectToFile`: path to redirect logs to - needed when console is flooded with too many messages and supresses them
- `ngComponents.forceEnable`: force enable the extension if AngularJS was not detected automatically
- `ngComponents.angularRoot`: custom Angular root folder relative to workspace root (defaults to workspace root) - use when your workspace contains more projects and Angular project is in a subfolder
- `ngComponents.memberDiagnostics.enabled`: enable experimental member diagnostics [details](#component-member-diagnostics) (default: **false**)
- `ngComponents.memberDiagnostics.html.checkBindings`: when disabled use of component's binding in the template when it's not defined in the controller will issue a warning
- `ngComponents.memberDiagnostics.html.checkControllerMembers`: when disabled use of component's controller member in the template will issue a warning
- `ngComponents.memberDiagnostics.didYouMean.similarityThreshold`: similarity thresold for Did You Mean suggestions (default: **0.6**)
- `ngComponents.memberDiagnostics.didYouMean.maxResults`: determines how many suggestions to show if there are more available (default: **2**)

Whenever one of the globs changes components cache is automatically rebuilt. Additionally all component files are monitored for changes and they will be reflected immediately, ie. after adding a binding you can just save the file and go straight to template file to use that binding.

> **Note:** all configuration settings using globs are actually using built-in globs described [here](https://code.visualstudio.com/docs/extensionAPI/vscode-api#GlobPattern) 

# Commands

This extension contributes the following commands to the Command palette.

- `Refresh Components Cache`: refreshes components cache on demand
- `Refresh Member Diagnostics`: refreshes [member diagnostics](#component-member-diagnostics) on demand
- `Find unused Angular components`: searches for [unused components](#find-unused-components)
- `Force enable ngComponents utility on this workspace`: see above for description of `ngComponents.forceEnable`
- `Switch between component/controller/template`: switches between component/controller/template inside a component

# Performance note on configuration globs

Please use as specific globs as possible. Parsing files is only a fraction of the whole process.
Vast majority of time is consumed on "globbing" for files to be processed so the more precise the globs are the better performance you can expect.


In my example project there are around 22k files and 3k folders. Given default glob pattern it takes slightly above a second to scan all these folders to find all component files.
Restricting the pattern to one single subfolder (ie. **subdir/\*\*/\*Component.ts**) which contains only 3k files and 500 folders it goes down to around 200-300ms on my machine being almost a second faster than the default.

The bigger the project the greater the impact so in general it is better to use multiple specific patterns rather than *one pattern to glob them all* :)

> **New in 0.7.0:** glob library has been fully replaced with built-in VSCode API to find files and it's simply much better  
> No longer needs to be so specific with glob patterns - it should perform very well on default settings as well (well, it does for me)

# Changelog

Full changelog is available [here](https://github.com/ipatalas/ngComponentUtility/blob/master/CHANGELOG.md) or in the Changelog tab from within vscode itself.

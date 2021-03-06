'use strict';

import * as _ from 'lodash';
import * as vsc from 'vscode';
import { Component } from './component';
import { Controller } from '../controller/controller';
import { SourceFile } from '../sourceFile';
import { SourceFilesScanner } from '../sourceFilesScanner';
import { FileWatcher } from '../fileWatcher';
import { EventEmitter } from 'events';
import { events } from '../../symbols';
import { logError } from '../logging';
import { getConfiguration } from '../vsc';
import { RelativePath } from '../htmlTemplate/relativePath';

export class ComponentsCache extends EventEmitter implements vsc.Disposable {
	private scanner = new SourceFilesScanner();
	private components: Component[] = [];
	private controllers: Controller[] = [];
	private componentWatcher: FileWatcher;
	private controllerWatcher: FileWatcher;

	private emitComponentsChanged = () => this.emit(events.componentsChanged, this.components);

	private setupWatchers = (config: vsc.WorkspaceConfiguration) => {
		const componentGlobs = config.get('componentGlobs') as string[];
		const controllerGlobs = config.get('controllerGlobs') as string[];

		this.dispose();

		this.componentWatcher = new FileWatcher('Component', componentGlobs, this.onComponentAdded, this.onComponentChanged, this.onComponentDeleted);
		this.controllerWatcher = new FileWatcher('Controller', controllerGlobs, this.onControllerAdded, this.onControllerChanged, this.onControllerDeleted);
	}

	private onControllerAdded = async (uri: vsc.Uri) => {
		const src = await SourceFile.parse(uri.fsPath);
		const controllers = await Controller.parse(src);

		this.controllers.push.apply(this.controllers, controllers);
		this.reassignControllers(controllers);
		this.assignControllersBaseClasses();
		this.emitComponentsChanged();
	}

	private onControllerDeleted = (uri: vsc.Uri) => {
		const filepath = RelativePath.fromUri(uri);
		const controllersInFile = this.controllers.filter(c => filepath.equals(c.path));

		this.components
			.filter(c => controllersInFile.some(ctrl => ctrl === c.controller))
			.forEach(c => c.controller = null);

		this.deleteFile(this.controllers, filepath);
		this.assignControllersBaseClasses();
		this.emitComponentsChanged();
	}

	private onControllerChanged = async (uri: vsc.Uri) => {
		const filepath = RelativePath.fromUri(uri);

		const idx = this.controllers.findIndex(c => filepath.equals(c.path));
		if (idx === -1) {
			// tslint:disable-next-line:no-console
			console.warn('Controller does not exist, cannot update it');
			return;
		}

		const src = await SourceFile.parse(filepath.absolute);
		const controllers = await Controller.parse(src);

		this.deleteFile(this.controllers, filepath);
		this.controllers.push.apply(this.controllers, controllers);

		this.reassignControllers(controllers);
		this.assignControllersBaseClasses();
		this.emitComponentsChanged();
	}

	private reassignControllers = (changedControllers: Controller[]) => {
		// check if there are any components already using these new controllers and assign them if so
		const ctrlNames = _.keyBy(changedControllers, c => c.name);
		const ctrlClassNames = _.keyBy(changedControllers, c => c.className);

		this.components
			.filter(c => c.controllerName && ctrlNames[c.controllerName] != null)
			.forEach(c => c.controller = ctrlNames[c.controllerName]);

		this.components
			.filter(c => c.controllerClassName && ctrlClassNames[c.controllerClassName] != null)
			.forEach(c => c.controller = ctrlClassNames[c.controllerClassName]);
	}

	private assignControllersBaseClasses = () => {
		const controllersByClassName = _.keyBy(this.controllers, c => c.className);

		this.controllers.filter(c => c.baseClassName).forEach(c => c.baseClass = controllersByClassName[c.baseClassName]);
	}

	private onComponentAdded = async (uri: vsc.Uri) => {
		const src = await SourceFile.parse(uri.fsPath);
		const components = await Component.parse(src, this.controllers);

		this.components.push.apply(this.components, components);
		this.emitComponentsChanged();
	}

	private onComponentChanged = async (uri: vsc.Uri) => {
		const filepath = RelativePath.fromUri(uri);

		const idx = this.components.findIndex(c => filepath.equals(c.path));
		if (idx === -1) {
			// tslint:disable-next-line:no-console
			console.warn('Component does not exist, cannot update it');
			return;
		}

		const src = await SourceFile.parse(filepath.absolute);
		const components = await Component.parse(src, this.controllers);

		this.deleteFile(this.components, filepath);
		this.components.push.apply(this.components, components);
		this.emitComponentsChanged();
	}

	private onComponentDeleted = (uri: vsc.Uri) => {
		this.deleteFile(this.components, RelativePath.fromUri(uri));
		this.emitComponentsChanged();
	}

	private deleteFile = (collection: Array<{ path: string }>, filepath: RelativePath) => {
		let idx;
		do {
			idx = collection.findIndex(c => filepath.equals(c.path));
			if (idx > -1) {
				collection.splice(idx, 1);
			}
		} while (idx > -1);
	}

	public refresh = async (): Promise<IComponentInfoResult> => {
		const config = getConfiguration();

		this.setupWatchers(config);
		this.controllers = await this.scanner.findFiles('controllerGlobs', Controller.parse, 'Controller');
		this.assignControllersBaseClasses();

		const parseComponent = (src: SourceFile) => Component.parse(src, this.controllers);

		return this.scanner.findFiles('componentGlobs', parseComponent, 'Component').then((result: Component[]) => {
			this.components = result;

			return {
				components: this.components,
				controllers: this.controllers
			};
		}).catch((err) => {
			logError(err);
			vsc.window.showErrorMessage('There was an error refreshing components cache, check console for errors');
			return {
				components: null,
				controllers: null
			};
		});
	}

	public dispose() {
		if (this.componentWatcher) {
			this.componentWatcher.dispose();
		}

		if (this.controllerWatcher) {
			this.controllerWatcher.dispose();
		}

		this.removeAllListeners();
	}
}

export interface IComponentInfoResult {
	components: Component[];
	controllers: Controller[];
}

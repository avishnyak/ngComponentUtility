'use strict';

import * as vsc from 'vscode';

import { CompletionProvider } from './completionProvider';
import { MemberCompletionProvider } from './memberCompletionProvider';
import { BindingProvider } from './bindingProvider';
import { GoToDefinitionProvider } from './definitionProvider';
import { ReferencesProvider } from "./referencesProvider";

import { overrideConsole, revertConsole, ConfigurationChangeListener, IConfigurationChangedEvent } from './utils/vsc';
import { ComponentsCache } from './utils/componentsCache';
import { HtmlReferencesCache } from "./utils/htmlReferencesCache";
import { init as initGlob } from './utils/glob';

const HTML_DOCUMENT_SELECTOR: vsc.DocumentSelector = 'html';
const TS_DOCUMENT_SELECTOR: vsc.DocumentSelector = 'typescript';
const COMMAND_REFRESHCOMPONENTS: string = 'extension.refreshAngularComponents';

const completionProvider = new CompletionProvider();
const memberCompletionProvider = new MemberCompletionProvider();
const bindingProvider = new BindingProvider();
const definitionProvider = new GoToDefinitionProvider();
const referencesProvider = new ReferencesProvider();

const componentsCache = new ComponentsCache();
const htmlReferencesCache = new HtmlReferencesCache();

const statusBar = vsc.window.createStatusBarItem(vsc.StatusBarAlignment.Left);
const debugChannel = vsc.window.createOutputChannel("ng1.5 components utility - debug");
const configListener = new ConfigurationChangeListener("ngComponents");

export async function activate(context: vsc.ExtensionContext) {
	context.subscriptions.push(debugChannel);
	context.subscriptions.push(configListener);
	refreshDebugConsole();

	try {
		initGlob(vsc.workspace.rootPath);

		await refreshComponents();
	} catch (err) {
		console.error(err);
		vsc.window.showErrorMessage("Error initializing extension");
	}

	context.subscriptions.push(vsc.commands.registerCommand(COMMAND_REFRESHCOMPONENTS, () => {
		refreshComponents().then(() => {
			vsc.window.showInformationMessage('Components cache has been rebuilt');
		});
	}));

	context.subscriptions.push(configListener.onDidChange((event: IConfigurationChangedEvent) => {
		if (event.hasChanged("debugConsole")) {
			refreshDebugConsole(event.config);
		}

		if (event.hasChanged("controllerGlobs", "componentGlobs", "htmlGlobs")) {
			vsc.commands.executeCommand(COMMAND_REFRESHCOMPONENTS);
		}
	}));

	context.subscriptions.push(vsc.languages.registerCompletionItemProvider(HTML_DOCUMENT_SELECTOR, completionProvider, '<'));
	context.subscriptions.push(vsc.languages.registerCompletionItemProvider(HTML_DOCUMENT_SELECTOR, bindingProvider, ','));
	context.subscriptions.push(vsc.languages.registerCompletionItemProvider(HTML_DOCUMENT_SELECTOR, memberCompletionProvider, '.'));
	context.subscriptions.push(vsc.languages.registerDefinitionProvider(HTML_DOCUMENT_SELECTOR, definitionProvider));
	context.subscriptions.push(vsc.languages.registerReferenceProvider([HTML_DOCUMENT_SELECTOR, TS_DOCUMENT_SELECTOR], referencesProvider));

	statusBar.tooltip = 'Refresh Angular components';
	statusBar.command = COMMAND_REFRESHCOMPONENTS;
	statusBar.show();

	context.subscriptions.push(statusBar);
}

const refreshDebugConsole = (config?: vsc.WorkspaceConfiguration) => {
	config = config || vsc.workspace.getConfiguration("ngComponents");

	const debugConsoleEnabled = <boolean>config.get("debugConsole");
	if (debugConsoleEnabled) {
		overrideConsole(debugChannel);
	} else {
		revertConsole();
		debugChannel.hide();
	}
};

const refreshComponents = async (config?: vsc.WorkspaceConfiguration): Promise<void> => {
	return new Promise<void>(async (resolve, _reject) => {
		let references = await htmlReferencesCache.refresh(config);

		let components = await componentsCache.refresh(config);
		referencesProvider.load(references, components);
		completionProvider.loadComponents(components);
		memberCompletionProvider.loadComponents(components);
		bindingProvider.loadComponents(components);
		definitionProvider.loadComponents(components);

		statusBar.text = `$(sync) ${components.length} components`;

		resolve();
	});
};

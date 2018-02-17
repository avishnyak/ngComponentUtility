'use strict';

import * as vsc from 'vscode';

import { ComponentCompletionProvider } from './providers/componentCompletionProvider';
import { MemberCompletionProvider } from './providers/memberCompletionProvider';
import { BindingProvider } from './providers/bindingProvider';
import { ComponentDefinitionProvider } from './providers/componentDefinitionProvider';
import { ReferencesProvider } from './providers/referencesProvider';
import { FindUnusedComponentsCommand } from './commands/findUnusedComponents';

import { IComponentTemplate } from './utils/component/component';
import { ComponentsCache } from './utils/component/componentsCache';
import { HtmlReferencesCache } from './utils/htmlReferencesCache';
import { RoutesCache } from './utils/routesCache';
import { MemberDefinitionProvider } from './providers/memberDefinitionProvider';
import { ConfigurationChangeListener, IConfigurationChangedEvent } from './utils/configurationChangeListener';
import { logVerbose } from './utils/logging';
import { shouldActivateExtension, notAngularProject, markAsAngularProject, alreadyAngularProject } from './utils/vsc';
import { MemberReferencesProvider } from './providers/memberReferencesProvider';
import * as prettyHrtime from 'pretty-hrtime';

const HTML_DOCUMENT_SELECTOR = 'html';
const TS_DOCUMENT_SELECTOR = 'typescript';
const COMMAND_REFRESHCOMPONENTS: string = 'extension.refreshAngularComponents';
const COMMAND_FINDUNUSEDCOMPONENTS: string = 'extension.findUnusedAngularComponents';
const COMMAND_MARKASANGULAR: string = 'extension.markAsAngularProject';
const COMMANDS = [COMMAND_FINDUNUSEDCOMPONENTS, COMMAND_REFRESHCOMPONENTS];

const completionProvider = new ComponentCompletionProvider();
const memberCompletionProvider = new MemberCompletionProvider();
const bindingProvider = new BindingProvider();
const definitionProvider = new ComponentDefinitionProvider();
const referencesProvider = new ReferencesProvider();
const memberReferencesProvider = new MemberReferencesProvider();
const memberDefinitionProvider = new MemberDefinitionProvider();
const findUnusedAngularComponents = new FindUnusedComponentsCommand();

const componentsCache = new ComponentsCache();
const htmlReferencesCache = new HtmlReferencesCache();
const routesCache = new RoutesCache();

const statusBar = vsc.window.createStatusBarItem(vsc.StatusBarAlignment.Left);
const configListener = new ConfigurationChangeListener('ngComponents');

export async function activate(context: vsc.ExtensionContext) {
	if (!shouldActivateExtension()) {
		COMMANDS.forEach(cmd => context.subscriptions.push(vsc.commands.registerCommand(cmd, notAngularProject)));
		context.subscriptions.push(vsc.commands.registerCommand(COMMAND_MARKASANGULAR, markAsAngularProject));
		return;
	}

	context.subscriptions.push(configListener, componentsCache, htmlReferencesCache, routesCache);
	context.subscriptions.push(vsc.commands.registerCommand(COMMAND_MARKASANGULAR, alreadyAngularProject));

	try {
		await refreshComponents();
	} catch (err) {
		// tslint:disable-next-line:no-console
		console.error(err);
		vsc.window.showErrorMessage('Error initializing extension');
	}

	context.subscriptions.push.apply(context.subscriptions, [
		vsc.commands.registerCommand(COMMAND_REFRESHCOMPONENTS, () => {
			let t = process.hrtime();
			refreshComponents().then(() => {
				t = process.hrtime(t);
				vsc.window.showInformationMessage(`Components cache has been rebuilt (${prettyHrtime(t)})`);
			});
		}),
		configListener.onDidChange((event: IConfigurationChangedEvent) => {
			if (event.hasChanged('controllerGlobs', 'componentGlobs', 'htmlGlobs')) {
				vsc.commands.executeCommand(COMMAND_REFRESHCOMPONENTS);
			}
		}),
		vsc.commands.registerCommand(COMMAND_FINDUNUSEDCOMPONENTS, () => findUnusedAngularComponents.execute()),
		vsc.languages.registerCompletionItemProvider(HTML_DOCUMENT_SELECTOR, completionProvider, '<'),
		vsc.languages.registerCompletionItemProvider(HTML_DOCUMENT_SELECTOR, bindingProvider, ','),
		vsc.languages.registerCompletionItemProvider(HTML_DOCUMENT_SELECTOR, memberCompletionProvider, '.'),
		vsc.languages.registerDefinitionProvider(HTML_DOCUMENT_SELECTOR, definitionProvider),
		vsc.languages.registerDefinitionProvider(HTML_DOCUMENT_SELECTOR, memberDefinitionProvider),
		vsc.languages.registerReferenceProvider([HTML_DOCUMENT_SELECTOR, TS_DOCUMENT_SELECTOR], referencesProvider),
		vsc.languages.registerReferenceProvider(TS_DOCUMENT_SELECTOR, memberReferencesProvider)
	]);

	statusBar.tooltip = 'Refresh Angular components';
	statusBar.command = COMMAND_REFRESHCOMPONENTS;
	statusBar.show();

	context.subscriptions.push(statusBar);
}

const refreshComponents = async (config?: vsc.WorkspaceConfiguration): Promise<void> => {
	return new Promise<void>(async (resolve, _reject) => {
		try {
			const references = await htmlReferencesCache.refresh(config);
			const components = await componentsCache.refresh(config);
			const routes = await routesCache.refresh(config);

			const inlineTemplates: IComponentTemplate[] = [];
			inlineTemplates.push(...getTemplatesWithBody(components));
			inlineTemplates.push(...getTemplatesWithBody(routes));

			htmlReferencesCache.loadInlineTemplates(inlineTemplates);

			findUnusedAngularComponents.load(references, components);
			referencesProvider.load(references, components);
			memberReferencesProvider.load(components);

			completionProvider.loadComponents(components);
			memberCompletionProvider.loadComponents(components);
			bindingProvider.loadComponents(components);
			definitionProvider.loadComponents(components);
			memberDefinitionProvider.loadComponents(components);

			components.forEach(c => logVerbose(`Found component: ${c.name} { ctrl: ${c.controller && c.controller.name} } (${c.path})`));

			statusBar.text = `$(sync) ${components.length} components`;
		} catch (err) {
			// tslint:disable-next-line:no-console
			console.error(err);
			vsc.window.showErrorMessage('Error refreshing components, check developer console');
		}

		resolve();
	});
};

const getTemplatesWithBody = (source: Array<{ template: IComponentTemplate }>) => source.filter(c => c.template && c.template.body).map(c => c.template);

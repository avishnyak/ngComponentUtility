import * as ts from 'typescript';
import * as vsc from 'vscode';
import { MemberType, MemberBase } from './member';
import { IComponentBinding } from '../component/component';
import { Controller } from './controller';

export class ClassProperty extends MemberBase {
	public name: string;
	public readonly type: MemberType = MemberType.Property;

	private constructor(controller: Controller) {
		super(controller);
	}

	public static fromProperty(controller: Controller, node: ts.PropertyDeclaration | ts.GetAccessorDeclaration, sourceFile: ts.SourceFile) {
		const result = new ClassProperty(controller);
		result.fillCommonFields(node, sourceFile);

		return result;
	}

	public static fromConstructorParameter(controller: Controller, node: ts.ParameterDeclaration, sourceFile: ts.SourceFile) {
		const result = new ClassProperty(controller);
		result.fillCommonFields(node, sourceFile);

		return result;
	}

	public buildCompletionItem(bindings: IComponentBinding[]) {
		const item = this.createCompletionItem();
		item.kind = vsc.CompletionItemKind.Field;
		item.documentation = 'Type: ' + this.returnType || 'any';

		const binding = bindings.find(b => b.name === this.name);
		if (binding) {
			item.detail += `\r\nBinding: ${binding.type}`;
			item.kind = vsc.CompletionItemKind.Reference;
		}

		return item;
	}
}

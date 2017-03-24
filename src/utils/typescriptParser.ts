import * as ts from 'typescript';

export class TypescriptParser {
	private identifierNodes: Map<string, ts.Node[]> = new Map<string, ts.Node[]>();

	constructor(private sourceFile: ts.SourceFile) {

	}

	public addIdentifier = (node: ts.Identifier) => {
		if (!this.identifierNodes.has(node.text)) {
			this.identifierNodes.set(node.text, []);
		}

		this.identifierNodes.get(node.text).push(node);
	}

	public getVariableDefinition = (identifier: ts.Identifier) => {
		if (this.identifierNodes.has(identifier.text)) {
			let usages = this.identifierNodes.get(identifier.text);
			let varDeclaration = usages.find(u => u.parent.kind === ts.SyntaxKind.VariableDeclaration);
			if (varDeclaration) {
				return <ts.VariableDeclaration>varDeclaration.parent;
			}
		}
	}

	public getStringVariableValue = (identifier: ts.Identifier) => {
		let varDeclaration = this.getVariableDefinition(identifier);

		if (varDeclaration && varDeclaration.initializer.kind === ts.SyntaxKind.StringLiteral) {
			return (<ts.StringLiteral>varDeclaration.initializer).text;
		}
	}

	public getObjectLiteralVariableValue = (identifier: ts.Identifier) => {
		let varDeclaration = this.getVariableDefinition(identifier);

		if (varDeclaration && varDeclaration.initializer.kind === ts.SyntaxKind.ObjectLiteralExpression) {
			return <ts.ObjectLiteralExpression>varDeclaration.initializer;
		}
	}
	public findProperty = (obj: ts.ObjectLiteralExpression, name: string) => {
		return <ts.PropertyAssignment>obj.properties.find(v => v.name.getText(this.sourceFile) === name);
	}
}

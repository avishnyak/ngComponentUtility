import * as ts from "typescript";
import { SourceFile } from './sourceFile';

const ANGULAR_MODULE = /^angular\s*\.\s*module\((['"])[^'"]*\1\)$/i;

export class Controller {
	public name: string;
	public className: string;
	public path: string;
	public pos: ts.LineAndCharacter;

	public static parse(file: SourceFile): Promise<Controller[]> {
		return new Promise<Controller[]>((resolve, _reject) => {
			try {
				let results: Controller[] = Controller.parseWithApi(file.sourceFile).map(c => {
					c.path = file.path;
					return c;
				});

				resolve(results);
			} catch (e) {
				// tslint:disable-next-line:no-console
				console.log(`
There was an error analyzing ${file.sourceFile.fileName}.
Please report this as a bug and include failing controller if possible (remove or change sensitive data).`.trim());
				resolve([]);
			}
		});
	}

	private static parseWithApi(sourceFile: ts.SourceFile) {
		let results: Controller[] = [];

		visitAllChildren(sourceFile);

		return results;

		function visitAllChildren(node: ts.Node) {
			if (node.kind === ts.SyntaxKind.ClassDeclaration) {
				let classDeclaration = <ts.ClassDeclaration>node;

				let controller = new Controller();
				controller.name = controller.className = classDeclaration.name.text;
				controller.pos = sourceFile.getLineAndCharacterOfPosition(classDeclaration.members.pos);

				results.push(controller);
			} else if (node.kind === ts.SyntaxKind.CallExpression) {
				const call = <ts.CallExpression>node;
				const module = (<ts.PropertyAccessExpression>call.expression).expression.getText();

				if (ANGULAR_MODULE.test(module) && (call.expression as ts.PropertyAccessExpression).name.text === 'controller' && call.arguments.length === 2) {
					let controllerName = <ts.StringLiteral>call.arguments[0];
					let controllerIdentifier = <ts.Identifier>call.arguments[1];

					if (controllerName.text !== controllerIdentifier.text) {
						let ctrl = results.find(c => c.className === controllerIdentifier.text);
						if (ctrl) {
							ctrl.name = controllerName.text;
						}
					}
				}
			} else {
				node.getChildren().forEach(c => visitAllChildren(c));
			}
		}
	}
}
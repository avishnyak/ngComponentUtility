import * as glob from 'glob';
import * as vsc from 'vscode';
import * as _ from 'lodash';
import { SourceFile } from './sourceFile';

const PERF_TOTAL = "Total time consumed on scanning for {type}s";
const PERF_GLOB = "Time consumed on finding {type} files";
const PERF_PARSE = "Time consumed on parsing {type} files";
const PERF_ANALYZE = "Time consumed on analyzing {type} files";

// tslint:disable:no-console
export class SourceFilesScanner {
	private options: IOptions = {};

	public findFiles = <SourceFileType>(configKey: string, callbackFn: (src: SourceFile) => Promise<SourceFileType[]>, fileType: string) => {
		const TOTAL = PERF_TOTAL.replace("{type}", fileType);
		const GLOB = PERF_GLOB.replace("{type}", fileType);
		const PARSE = PERF_PARSE.replace("{type}", fileType);
		const ANALYZE = PERF_ANALYZE.replace("{type}", fileType);

		return new Promise<SourceFileType[]>(async (resolve, reject) => {
			console.time(TOTAL);
			let config = vsc.workspace.getConfiguration("ngComponents");
			let globs = <string[]>config.get(configKey);

			try {
				console.time(GLOB);
				let files = _.flatten(await Promise.all(globs.map(pattern => this.glob(pattern))));
				console.timeEnd(GLOB);

				console.time(PARSE);
				let sourceFiles = await Promise.all(files.map(SourceFile.parse));
				console.timeEnd(PARSE);

				console.time(ANALYZE);
				let components = await Promise.all(sourceFiles.map(callbackFn));
				let result = _.flatten(components);
				console.timeEnd(ANALYZE);

				console.timeEnd(TOTAL);

				resolve(result);
			} catch (e) {
				reject(e);
			}
		});
	}

	private glob = (pattern: string) => {
		return new Promise<string[]>((resolve, reject) => {
			glob(pattern, this.options, (err, matches) => {
				if (err) {
					return reject(err);
				}

				resolve(matches);
			});
		});
	}

	public init = (cwd: string) => {
		this.options.cwd = cwd;
		this.options.absolute = true;
	}
}

// @types/glob does not have 'absolute' field available yet
interface IOptions extends glob.IOptions {
	absolute?: boolean;
}
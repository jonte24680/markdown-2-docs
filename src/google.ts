import { google, docs_v1, Auth, Common } from "googleapis";
import { getAuth } from "./authGoogle";
import * as vscode from 'vscode';
import { type } from "os";

async function getDocsManager(){
	const auth = await getAuth();
	
	return google.docs({version: "v1", auth: auth});
}

/*export async function firstTest(){
	const docsManager = await getDocsManager();
	//const driveManager = google.drive({version: "v3", auth: auth});
	
	console.log("is valid" + docsManager.context._options.validateStatus);

	const nått = await docsManager.documents.get({documentId: "1W0L_HGa-RqW_dD6WW5iIiE_lHKPSlz_P8GiWPqG0jw8"});
	
	const req = await docsManager.documents.batchUpdate({
		documentId: "1W0L_HGa-RqW_dD6WW5iIiE_lHKPSlz_P8GiWPqG0jw8",
		requestBody: {
			requests: [
				{
					insertText: {
						endOfSegmentLocation: {},
						text: "\n" + (new Date()).toTimeString()
					}
				}
			]
		}
	});

	console.log(req);
}*/


export async function markdownToDocs() {
	const editor = vscode.window.activeTextEditor;

	if(editor !== undefined){ // add limitation what onle make .md file pass truhe
		const docsManager = await getDocsManager();
		var googleDocsId = await vscode.window.showInputBox({value: "1W0L_HGa-RqW_dD6WW5iIiE_lHKPSlz_P8GiWPqG0jw8"});
		if(googleDocsId !== undefined){
			if(googleDocsId === ""){
				const newDocs = await docsManager.documents.create({
					requestBody: {
						title: editor.document.fileName
					}
				});

				if(typeof(newDocs.data.documentId) !== typeof("string")){
					return;
				}

				googleDocsId = newDocs.data.documentId as string;
			}

			const req = await docsManager.documents.batchUpdate({
				documentId: googleDocsId,
				requestBody: {
					requests: [
						{
							insertText: {
								endOfSegmentLocation: {},
								text: editor.document.getText()
							}
						}
					]
				}
			});
		} 
	}
}
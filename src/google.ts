import { google, docs_v1, Auth, Common } from "googleapis";
import { getAuth } from "./authGoogle";
import * as vscode from 'vscode';
import { type } from "os";
import { file } from "googleapis/build/src/apis/file";
import { streetviewpublish } from "googleapis/build/src/apis/streetviewpublish";
import { markdownToGoogleDocsReq } from "./convert";

async function getDocsManager(){
	return (await getManagers()).docs;
}

async function getDriveManager(){
	return (await getManagers()).drive;
}

async function getManagers(){
	const auth = await getAuth();
	
	return {
		docs: google.docs({version: "v1", auth: auth}),
		drive: google.drive({version: "v3", auth: auth})
	};
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
		const managers = await getManagers();

		const files = await managers.drive.files.list({
			q: "mimeType = 'application/vnd.google-apps.document'",
			//orderBy: "title",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true
		});
		console.log(files);
		
		interface InputDocsName extends vscode.QuickPickItem{
			documentId: string
		}

		var input: Array<InputDocsName> = new Array<InputDocsName>();

		files.data.files?.forEach((file) => {
			if(file.trashed === true){
				return;
			}
			input.push({
				documentId: file.id as string,
				label: file.name as string
			});
		});

		var docs = await vscode.window.showQuickPick(input);

		if(docs === undefined){
			/*const requestNewDocs = await vscode.window.showInformationMessage("Wound you like to create a new document", {title: "Yes"}, {title: "No", isCloseAffordance: true});
			if(requestNewDocs?.title !== "Yes"){
				return;
			}*/

			const requestNewDocs = await vscode.window.showQuickPick( ["Yes", "No"], {title: "Wound you like to create a new document"});
			if(requestNewDocs !== "Yes"){
				return;
			}

			const documentName = await vscode.window.showInputBox({title: "Document name", prompt: "Write the name the new documet is getting", placeHolder: "name"});
			if(documentName === undefined){
				return;
			}

			const newDocs = await managers.docs.documents.create({
				requestBody: {
					title: documentName
				}
			});

			if(typeof(newDocs.data.documentId) !== typeof("string")){
				return;
			}

			docs = {documentId: newDocs.data.documentId as string, label: ""};
		}

		vscode.window.showInformationMessage("converting Markdown to Google Docs");

		try {
			var req = markdownToGoogleDocsReq(editor.document.getText());
			const res = await managers.docs.documents.batchUpdate({
				documentId: docs.documentId,
				requestBody: {
					requests: req
				}
			});
			vscode.window.showInformationMessage("Converted Sucessfully Markdown To Google Docs");
		} catch (error: any) {
			console.error(error.message);
			vscode.window.showErrorMessage(error.message );
		}
	}
}
import { google, docs_v1, Auth, Common } from "googleapis";
import { ClientSecret } from "./models/clientSecret";
import * as http from "http";
import path = require('path');
import url = require('url');
import opn = require('open');
import * as vscode from 'vscode';

const REFRESH_KEY = "markdown2Docs_refreshToken";
const SCOPES = [
	"https://www.googleapis.com/auth/documents",
	"https://www.googleapis.com/auth/drive.readonly"
];
const keys = require("../secret/client_secret.json") as ClientSecret;
var oauth2Client: Auth.OAuth2Client = new google.auth.OAuth2(keys.web.client_id, keys.web.client_secret, keys.web.redirect_uris[0]); 
var secretStorage: vscode.SecretStorage | null = null;

export async function extensionActivation(context: vscode.ExtensionContext) {

	oauth2Client.on("tokens", (tokens) => {
		if(tokens.refresh_token && secretStorage ){
			secretStorage.store(REFRESH_KEY, tokens.refresh_token);
		}
	});

	secretStorage = context.secrets;
	const key = await secretStorage.get(REFRESH_KEY);
	if(!key || key === ""){
		return;
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	oauth2Client.setCredentials({refresh_token: key});
}

export async function getAuth(){
	if(oauth2Client.credentials.refresh_token){
		return oauth2Client;
	}
	if(secretStorage){
		const key = await secretStorage.get(REFRESH_KEY);
		if(key && key !== ""){
			// eslint-disable-next-line @typescript-eslint/naming-convention
			oauth2Client.setCredentials({refresh_token: key});
			return oauth2Client;
		}
	}

	await showGoogleOAuthScreen();
	return oauth2Client;
}

async function showGoogleOAuthScreen(){
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const authURl = oauth2Client.generateAuthUrl({scope: SCOPES.join(" "), access_type: "offline"});

	var authyMade = await new Promise<Auth.Credentials>((resolve, reject) => {
		const server = http.createServer((req, res) => {
			try {
				if(req === undefined || req.url === undefined){
					server.close();
					reject(`Is undefined, req ${req === undefined}, req.url ${req.url === undefined}`);
					return;
				}
				
				if (req.url.indexOf('/oauth2callback') > -1) {
					const qs = new url.URL(req.url, 'http://localhost:3000')
					.searchParams;
					res.end('Authentication successful! Please return to the console.');
					server.close();
					if(qs && oauth2Client !== undefined){
						oauth2Client.getToken(qs.get('code') as string).then((response) => {
							if (oauth2Client !== undefined){
								resolve(response.tokens);
								return;
							}
						});
					}
				}
			} catch (e) {
				server.close();
				reject(e);
				return;
			}
			//server.close();
			//reject("somthin diden go to plan");
		}).listen(3000, () => {
			// open the browser to the authorize url to start the workflow
			vscode.env.openExternal(vscode.Uri.parse(authURl));
			//opn(authURl, {wait: false}).then(cp => cp.unref());
			new Promise(timeoutResponse => setTimeout(timeoutResponse, 5*60*1000)).then(()=> {
				server.close();
				reject("Request took to long (longer then 5 min)");
				return;
			});
		});
	});
	if(secretStorage && authyMade.refresh_token){
		secretStorage.store(REFRESH_KEY, authyMade.refresh_token);
	}
	
	oauth2Client.credentials = authyMade;
}

export function isAutherized(){
	return oauth2Client !== undefined; // todo: oauth2client can be definde bu still not autherized
}
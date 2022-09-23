import { google, docs_v1, Auth, Common } from "googleapis";
import { ClientSecret } from "./models/clientSecret";
import * as http from "http";
import path = require('path');
import url = require('url');
import opn = require('open');

const SCOPES = [
	"https://www.googleapis.com/auth/documents",
	"https://www.googleapis.com/auth/drive.readonly"
];

var oauth2Client: Auth.OAuth2Client; 

export async function getAuth(){
	const keys = require("../secret/client_secret.json") as ClientSecret;
	if(oauth2Client === undefined){
		oauth2Client = new google.auth.OAuth2(keys.web.client_id, keys.web.client_secret, keys.web.redirect_uris[0]);

		const authURl = oauth2Client.generateAuthUrl({scope: SCOPES.join(" ")});
	
		var authyMade = await new Promise<Auth.Credentials>((resolve, reject) => {
			const server = http.createServer((req, res) => {
				try {
					if(req === undefined || req.url === undefined){
						server.close();
						reject("somting is null");
						return;
					}
					
					if (req.url.indexOf('/oauth2callback') > -1) {
						const qs = new url.URL(req.url, 'http://localhost:3000')
						.searchParams;
						res.end('Authentication successful! Please return to the console.');
						server.close();
						if(qs && oauth2Client){
							oauth2Client.getToken(qs.get('code') as string).then((response) => {
								if (oauth2Client){
									resolve(response.tokens);
									return;
								}
							});
						}
					}
				} catch (e) {
					reject(e);
				}
				server.close();
				reject("somthin diden go to plan");
			}).listen(3000, () => {
				// open the browser to the authorize url to start the workflow
				opn(authURl, {wait: false}).then(cp => cp.unref());
			});
			return;
		});
		oauth2Client.credentials = authyMade;
	}
	return oauth2Client;
}
import { google, docs_v1, Auth, Common } from "googleapis";

export function markdownToGoogleDocsReq(markdown: string): docs_v1.Schema$Request[]{
	var req = new Array<docs_v1.Schema$Request>();
	req.push({
		insertText: {
			endOfSegmentLocation: {},
			text: markdown
		}
	});
	return req;
}
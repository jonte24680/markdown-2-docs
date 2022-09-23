import { google, docs_v1, Auth, Common } from "googleapis";
import { getAuth } from "./authGoogle";
export async function FirstTest(){
	const auth = await getAuth();
	

	const docsManager = google.docs({version: "v1", auth: auth});

	const nått = await docsManager.documents.get({documentId: "1W0L_HGa-RqW_dD6WW5iIiE_lHKPSlz_P8GiWPqG0jw8"});
	console.log(nått);
}


